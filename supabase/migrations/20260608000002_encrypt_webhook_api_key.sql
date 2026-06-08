-- =============================================
-- Encriptar API keys do webhook usando Supabase Vault
-- A api_key fica no vault.secrets (inserir via Dashboard SQL Editor)
-- A function process_webhook_queue lê do vault na hora de enviar
-- =============================================

-- 1. Adicionar coluna de referência ao vault
alter table public.webhook_config
  add column if not exists vault_secret_name text;

-- Preencher referência
update public.webhook_config
set vault_secret_name = 'webhook_api_key_' || name
where vault_secret_name is null;

-- Limpar api_key (substituir por placeholder)
update public.webhook_config
set api_key = '***encrypted***'
where api_key <> '***encrypted***';

-- 2. Function helper pra buscar a key decriptada
create or replace function public.get_webhook_api_key(config_name text)
returns text as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'webhook_api_key_' || config_name
  limit 1;
$$ language sql security definer stable;

-- 3. Atualizar process_webhook_queue pra usar vault
create or replace function public.process_webhook_queue()
returns void as $$
declare
  v_item record;
  v_config record;
  v_api_key text;
  v_request_id bigint;
begin
  for v_item in
    select q.*
    from public.webhook_queue q
    where q.status in ('pending', 'processing')
      and q.next_retry_at <= now()
      and q.attempts < q.max_attempts
    order by q.created_at
    limit 10
    for update skip locked
  loop
    select * into v_config
    from public.webhook_config
    where name = v_item.config_name and active = true;

    if not found then
      update public.webhook_queue
      set status = 'failed', last_error = 'Webhook config not found or inactive'
      where id = v_item.id;
      continue;
    end if;

    -- Buscar API key do vault
    v_api_key := public.get_webhook_api_key(v_item.config_name);
    if v_api_key is null or v_api_key = '' then
      update public.webhook_queue
      set status = 'failed', last_error = 'API key not found in vault'
      where id = v_item.id;
      continue;
    end if;

    update public.webhook_queue
    set status = 'processing', attempts = attempts + 1
    where id = v_item.id;

    select net.http_post(
      url := v_config.url,
      body := v_item.payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', v_api_key,
        'X-Webhook-Id', v_item.id::text,
        'X-Webhook-Event', 'order.approved'
      )
    ) into v_request_id;

  end loop;
end;
$$ language plpgsql security definer;

-- =============================================
-- INSTRUÇÃO MANUAL (rodar no Supabase Dashboard > SQL Editor):
--
-- INSERT INTO vault.secrets (name, secret, description)
-- VALUES (
--   'webhook_api_key_orders_approved',
--   'SUA_API_KEY_ALLCANCE_AQUI',
--   'API key para webhook de pedidos aprovados - Allcance'
-- );
-- =============================================
