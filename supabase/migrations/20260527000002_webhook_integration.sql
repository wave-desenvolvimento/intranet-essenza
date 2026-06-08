-- =============================================
-- Webhook de integracao — Allcance
-- Adiciona campos de mapeamento externo + trigger no formato Allcance
-- pg_net (HTTP) + pg_cron (retry) + webhook_queue (fila)
-- =============================================

-- ===========================================
-- PARTE 0: Tabelas auxiliares (payment_plans, shipping_types, colunas orders)
-- ===========================================

-- Condicoes de pagamento
create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  installments int not null default 1,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_plans enable row level security;

do $$ begin
  create policy "payment_plans_select" on public.payment_plans
    for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "payment_plans_manage" on public.payment_plans
    for all to authenticated using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    ) with check (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    );
exception when duplicate_object then null;
end $$;

-- Tipos de frete
create table if not exists public.shipping_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_types enable row level security;

do $$ begin
  create policy "shipping_types_select" on public.shipping_types
    for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "shipping_types_manage" on public.shipping_types
    for all to authenticated using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    ) with check (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    );
exception when duplicate_object then null;
end $$;

-- Colunas extras em orders
alter table public.orders
  add column if not exists payment_plan_id uuid references public.payment_plans(id) on delete set null,
  add column if not exists shipping_type_id uuid references public.shipping_types(id) on delete set null,
  add column if not exists purchase_order text,
  add column if not exists seller_id uuid references auth.users(id) on delete set null,
  add column if not exists admin_notes text,
  add column if not exists approved_at timestamptz;

-- ===========================================
-- PARTE 1: Webhook Config + Queue
-- ===========================================

create table if not exists public.webhook_config (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text not null,
  api_key text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inserir config padrao se nao existe
insert into public.webhook_config (name, url, api_key, active, metadata)
values (
  'orders_approved',
  'https://exemplo.com/webhook/pedidos',
  'CHANGE_ME',
  false,
  jsonb_build_object(
    'representada_id', 495378,
    'representada_nome_fantasia', 'Essenza',
    'representada_razao_social', 'Essenza'
  )
)
on conflict (name) do nothing;

alter table public.webhook_config enable row level security;

do $$ begin
  create policy "webhook_config_admin" on public.webhook_config
    for all to authenticated using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    ) with check (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    );
exception when duplicate_object then null;
end $$;

create table if not exists public.webhook_queue (
  id uuid primary key default gen_random_uuid(),
  config_name text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  last_status_code int,
  next_retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_webhook_queue_pending on public.webhook_queue(status, next_retry_at)
  where status in ('pending', 'processing');

alter table public.webhook_queue enable row level security;

do $$ begin
  create policy "webhook_queue_admin" on public.webhook_queue
    for all to authenticated using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    ) with check (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.is_system = true
      )
    );
exception when duplicate_object then null;
end $$;

-- ===========================================
-- PARTE 2: Campos de integracao externa
-- ===========================================

-- Franchises: external_id (cliente_id na Allcance) + dados fiscais/endereco
alter table public.franchises
  add column if not exists external_id integer,
  add column if not exists razao_social text,
  add column if not exists inscricao_estadual text,
  add column if not exists address_number text,
  add column if not exists complemento text;

-- Profiles: external_id (criador_id/vendedor_id na Allcance) + comissao
alter table public.profiles
  add column if not exists external_id integer,
  add column if not exists comissao_percentual decimal(5,2) not null default 0;

-- Products: external_id (produto_id na Allcance)
alter table public.products
  add column if not exists external_id integer;

-- Product Prices: external_id (tabela_preco_id na Allcance)
alter table public.product_prices
  add column if not exists external_id integer;

-- Payment Plans: external_id (condicao_pagamento_id) + forma_pagamento_external_id
alter table public.payment_plans
  add column if not exists external_id integer,
  add column if not exists forma_pagamento_external_id integer;

-- Webhook Config: metadata para valores fixos (representada_id, etc.)
-- (coluna ja existe no CREATE TABLE acima, update dos dados)
update public.webhook_config
set metadata = jsonb_build_object(
  'representada_id', 495378,
  'representada_nome_fantasia', 'Essenza',
  'representada_razao_social', 'Essenza'
)
where name = 'orders_approved';

-- ===========================================
-- PARTE 3: Trigger — formato Allcance 1:1
-- ===========================================

create or replace function public.on_order_approved()
returns trigger as $$
declare
  v_payload jsonb;
  v_franchise record;
  v_items jsonb;
  v_creator record;
  v_seller record;
  v_config record;
  v_payment_plan record;
  v_oc_number bigint;
  v_comissoes jsonb;
begin
  -- So dispara quando status muda para 'aprovado'
  if NEW.status <> 'aprovado' or OLD.status = 'aprovado' then
    return NEW;
  end if;

  -- Busca config (precisa do metadata para representada)
  select * into v_config
  from public.webhook_config
  where name = 'orders_approved' and active = true;

  if not found then
    return NEW;
  end if;

  -- Busca dados da franquia
  select f.* into v_franchise
  from public.franchises f
  where f.id = NEW.franchise_id;

  -- Busca dados do criador
  select p.external_id, p.full_name, p.comissao_percentual into v_creator
  from public.profiles p
  where p.id = NEW.created_by;

  -- Busca dados do vendedor (seller)
  select p.external_id, p.full_name, p.comissao_percentual into v_seller
  from public.profiles p
  where p.id = NEW.seller_id;

  -- Busca condicao de pagamento
  select pp.external_id, pp.name, pp.forma_pagamento_external_id into v_payment_plan
  from public.payment_plans pp
  where pp.id = NEW.payment_plan_id;

  -- Extrai numero do OC (OC-000042 -> 42)
  v_oc_number := coalesce(
    nullif(regexp_replace(NEW.purchase_order, '[^0-9]', '', 'g'), '')::int,
    0
  );

  -- Busca itens do pedido no formato Allcance
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', null,
    'produto_id', pr.external_id,
    'tabela_preco_id', pp.external_id,
    'quantidade', oi.quantity::float,
    'quantidade_grades', '[]'::jsonb,
    'preco_tabela', oi.unit_price::float,
    'preco_liquido', oi.unit_price::float,
    'ipi', 0.0,
    'tipo_ipi', 'P',
    'st', 0.0,
    'subtotal', oi.subtotal::float,
    'cotacao_moeda', 1.0,
    'excluido', false,
    'descontos_do_vendedor', '[]'::jsonb,
    'descontos_de_promocoes', '[]'::jsonb,
    'descontos_de_politicas', '[]'::jsonb,
    'observacoes', '',
    'produto_codigo', coalesce(pr.sku, ''),
    'produto_nome', oi.product_name,
    'grupo_grades', null,
    'produto_agregador_id', null,
    'desconto_de_cupom', null
  )), '[]'::jsonb) into v_items
  from public.order_items oi
  left join public.products pr on pr.id = oi.product_id
  left join public.product_prices pp on pp.product_id = oi.product_id
    and pp.segment = coalesce(v_franchise.segment, 'franquia');

  -- Monta comissoes dos vendedores
  v_comissoes := '[]'::jsonb;
  if v_seller.external_id is not null then
    v_comissoes := jsonb_build_array(jsonb_build_object(
      'vendedor_id', v_seller.external_id,
      'percentual', coalesce(v_seller.comissao_percentual, 0)::float
    ));
  elsif v_creator.external_id is not null then
    v_comissoes := jsonb_build_array(jsonb_build_object(
      'vendedor_id', v_creator.external_id,
      'percentual', coalesce(v_creator.comissao_percentual, 0)::float
    ));
  end if;

  -- Monta payload no formato Allcance
  v_payload := jsonb_build_array(jsonb_build_object(
    'id', null,
    'pedido_origem_id', null,
    'cliente_id', v_franchise.external_id,
    'transportadora_id', 0,
    'transportadora_nome', '',
    'tipo_pedido_id', null,
    'criador_id', coalesce(v_seller.external_id, v_creator.external_id),
    'nome_contato', '',
    'status', '2',
    'numero', v_oc_number,
    'rastreamento', '',
    'valor_frete', null,
    'total', NEW.total::float,
    'condicao_pagamento', coalesce(v_payment_plan.name, ''),
    'condicao_pagamento_id', v_payment_plan.external_id,
    'forma_pagamento_id', v_payment_plan.forma_pagamento_external_id,
    'data_emissao', to_char(coalesce(NEW.approved_at, now()), 'YYYY-MM-DD'),
    'observacoes', coalesce(NEW.notes, ''),
    'itens', v_items,
    'extras', '[]'::jsonb,
    'ultima_alteracao', to_char(coalesce(NEW.approved_at, now()), 'YYYY-MM-DD HH24:MI:SS'),
    'cliente_razao_social', coalesce(v_franchise.razao_social, v_franchise.name),
    'cliente_nome_fantasia', v_franchise.name,
    'cliente_cnpj', coalesce(regexp_replace(v_franchise.cnpj, '[^0-9]', '', 'g'), ''),
    'cliente_inscricao_estadual', coalesce(v_franchise.inscricao_estadual, ''),
    'cliente_rua', coalesce(v_franchise.address, ''),
    'cliente_numero', coalesce(v_franchise.address_number, ''),
    'cliente_complemento', coalesce(v_franchise.complemento, ''),
    'cliente_cep', coalesce(regexp_replace(v_franchise.cep, '[^0-9]', '', 'g'), ''),
    'cliente_bairro', coalesce(v_franchise.neighborhood, ''),
    'cliente_cidade', coalesce(v_franchise.city, ''),
    'cliente_estado', coalesce(v_franchise.state, ''),
    'cliente_suframa', '',
    'contato_nome', '',
    'representada_id', (v_config.metadata->>'representada_id')::int,
    'representada_nome_fantasia', coalesce(v_config.metadata->>'representada_nome_fantasia', 'Essenza'),
    'representada_razao_social', coalesce(v_config.metadata->>'representada_razao_social', 'Essenza'),
    'status_faturamento', '0',
    'status_custom_id', null,
    'status_b2b', null,
    'endereco_entrega', jsonb_build_object(
      'id', null,
      'cep', null,
      'endereco', null,
      'numero', null,
      'complemento', null,
      'bairro', null,
      'cidade', null,
      'estado', null
    ),
    'data_criacao', to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS'),
    'cliente_telefone', case
      when v_franchise.phone is not null then jsonb_build_array(v_franchise.phone)
      else '[]'::jsonb
    end,
    'cliente_email', case
      when v_franchise.email is not null then jsonb_build_array(v_franchise.email)
      else '[]'::jsonb
    end,
    'cupom_de_desconto', null,
    'percentual_total_comissao_pedido', coalesce(v_seller.comissao_percentual, v_creator.comissao_percentual, 0)::float,
    'comissoes_vendedores', v_comissoes
  ));

  -- Insere na fila
  insert into public.webhook_queue (config_name, payload)
  values ('orders_approved', v_payload);

  return NEW;
end;
$$ language plpgsql security definer;

-- Recriar trigger
drop trigger if exists trg_order_approved on public.orders;
create trigger trg_order_approved
  after update on public.orders
  for each row
  when (NEW.status = 'aprovado' and OLD.status <> 'aprovado')
  execute function public.on_order_approved();

-- ===========================================
-- PARTE 4: Processamento da fila (pg_net + pg_cron)
-- ===========================================

create or replace function public.process_webhook_queue()
returns void as $$
declare
  v_item record;
  v_config record;
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

    update public.webhook_queue
    set status = 'processing', attempts = attempts + 1
    where id = v_item.id;

    select net.http_post(
      url := v_config.url,
      body := v_item.payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', v_config.api_key,
        'X-Webhook-Id', v_item.id::text,
        'X-Webhook-Event', 'order.approved'
      )
    ) into v_request_id;

  end loop;
end;
$$ language plpgsql security definer;

create or replace function public.check_webhook_responses()
returns void as $$
declare
  v_item record;
  v_response record;
begin
  for v_item in
    select q.*
    from public.webhook_queue q
    where q.status = 'processing'
  loop
    select r.status_code, r.content into v_response
    from net._http_response r
    where r.id in (
      select id from net._http_response
      order by created desc
      limit 50
    )
    and r.status_code is not null
    order by r.created desc
    limit 1;

    if found and v_response.status_code between 200 and 299 then
      update public.webhook_queue
      set status = 'delivered',
          delivered_at = now(),
          last_status_code = v_response.status_code
      where id = v_item.id;
    elsif found then
      if v_item.attempts >= v_item.max_attempts then
        update public.webhook_queue
        set status = 'failed',
            last_error = coalesce(v_response.content::text, 'HTTP ' || v_response.status_code),
            last_status_code = v_response.status_code
        where id = v_item.id;
      else
        update public.webhook_queue
        set status = 'pending',
            last_error = coalesce(v_response.content::text, 'HTTP ' || v_response.status_code),
            last_status_code = v_response.status_code,
            next_retry_at = now() + (power(2, v_item.attempts) || ' minutes')::interval
        where id = v_item.id;
      end if;
    else
      if v_item.created_at < now() - interval '30 seconds' then
        if v_item.attempts >= v_item.max_attempts then
          update public.webhook_queue
          set status = 'failed', last_error = 'Timeout -- sem resposta apos 30s'
          where id = v_item.id;
        else
          update public.webhook_queue
          set status = 'pending',
              last_error = 'Timeout -- sem resposta apos 30s',
              next_retry_at = now() + (power(2, v_item.attempts) || ' minutes')::interval
          where id = v_item.id;
        end if;
      end if;
    end if;
  end loop;

  delete from net._http_response where created < now() - interval '1 day';
end;
$$ language plpgsql security definer;

-- pg_cron jobs (idempotente)
do $$ begin
  perform cron.unschedule('process-webhook-queue');
exception when others then null;
end $$;
do $$ begin
  perform cron.unschedule('check-webhook-responses');
exception when others then null;
end $$;

select cron.schedule('process-webhook-queue', '* * * * *', $$select public.process_webhook_queue()$$);
select cron.schedule('check-webhook-responses', '* * * * *', $$select public.check_webhook_responses()$$);
