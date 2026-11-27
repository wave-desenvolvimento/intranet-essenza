-- ===========================================
-- Leads -> Dinamize com fila + retry
-- Substitui o Database Webhook "dinamize_form" (envio direto, sem retry)
-- e padroniza CNPJ de reseller_leads como somente digitos.
-- ===========================================

-- 1. CNPJ somente digitos em qualquer insert/update
create or replace function public.normalize_lead_cnpj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cnpj := nullif(regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g'), '');
  return new;
end;
$$;

drop trigger if exists reseller_leads_normalize_cnpj on public.reseller_leads;

create trigger reseller_leads_normalize_cnpj
  before insert or update of cnpj on public.reseller_leads
  for each row execute function public.normalize_lead_cnpj();

-- 2. Remove o webhook direto antes do backfill (senao reenviaria todos os leads)
drop trigger if exists dinamize_form on public.reseller_leads;

-- Backfill sem mexer em updated_at
alter table public.reseller_leads disable trigger reseller_leads_updated_at;

update public.reseller_leads set cnpj = cnpj where cnpj ~ '\D';

alter table public.reseller_leads enable trigger reseller_leads_updated_at;

-- 3. Config (URL editavel / desligavel sem deploy)
insert into public.webhook_config (name, url, api_key, active)
values ('dinamize_leads', '<DINAMIZE_RECEIVER_URL>', '-', true)
on conflict (name) do nothing;

-- 4. Fila dedicada
create table if not exists public.lead_webhook_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 6,
  request_id bigint,
  sent_at timestamptz,
  last_status_code int,
  last_error text,
  next_retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_lead_webhook_queue_open
  on public.lead_webhook_queue(status, next_retry_at)
  where status in ('pending', 'processing');

-- Sem policies: acesso so via funcoes security definer / service role
alter table public.lead_webhook_queue enable row level security;

-- 5. Enfileira no mesmo formato do Database Webhook (mapeamento da Dinamize continua valido)
create or replace function public.enqueue_lead_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_webhook_queue (lead_id, payload)
  values (
    new.id,
    jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end
    )
  );
  return new;
exception when others then
  -- nunca bloquear o cadastro do lead
  return new;
end;
$$;

drop trigger if exists trg_enqueue_lead_webhook on public.reseller_leads;

create trigger trg_enqueue_lead_webhook
  after insert or update on public.reseller_leads
  for each row execute function public.enqueue_lead_webhook();

-- 6. Processamento: confere respostas pelo request_id e depois envia os pendentes
create or replace function public.process_lead_webhook_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_resp record;
  v_url text;
  v_request_id bigint;
  v_error text;
begin
  -- 6a. respostas dos envios em andamento
  for v_item in
    select * from public.lead_webhook_queue
    where status = 'processing'
    for update skip locked
  loop
    select status_code, timed_out, error_msg, content into v_resp
    from net._http_response where id = v_item.request_id;

    if found and v_resp.status_code between 200 and 299 then
      update public.lead_webhook_queue
      set status = 'delivered', delivered_at = now(), last_status_code = v_resp.status_code, last_error = null
      where id = v_item.id;
      continue;
    end if;

    if found then
      v_error := coalesce(v_resp.error_msg, left(v_resp.content, 500), 'HTTP ' || v_resp.status_code);
    elsif v_item.sent_at < now() - interval '2 minutes' then
      v_error := 'Sem resposta apos 2 min';
    else
      continue; -- ainda aguardando
    end if;

    update public.lead_webhook_queue
    set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
        last_status_code = v_resp.status_code,
        last_error = v_error,
        next_retry_at = now() + make_interval(mins => power(2, attempts)::int)
    where id = v_item.id;
  end loop;

  -- 6b. envio dos pendentes
  select url into v_url from public.webhook_config where name = 'dinamize_leads' and active;
  if v_url is null then
    return;
  end if;

  for v_item in
    select * from public.lead_webhook_queue
    where status = 'pending' and next_retry_at <= now()
    order by created_at
    limit 20
    for update skip locked
  loop
    select net.http_post(
      url := v_url,
      body := v_item.payload,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    ) into v_request_id;

    update public.lead_webhook_queue
    set status = 'processing', attempts = attempts + 1, request_id = v_request_id, sent_at = now()
    where id = v_item.id;
  end loop;
end;
$$;

revoke all on function public.process_lead_webhook_queue() from public, anon, authenticated;

revoke all on function public.enqueue_lead_webhook() from public, anon, authenticated;

-- 7. Cron a cada minuto (idempotente)
do $$ begin
  perform cron.unschedule('process-lead-webhook-queue');
exception when others then null;
end $$;

select cron.schedule('process-lead-webhook-queue', '* * * * *', $$select public.process_lead_webhook_queue()$$);
