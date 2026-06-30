-- =============================================
-- Tabela de leads de revenda (formulários do site)
-- Recebe POST da loja Nuvemshop via Supabase REST API
-- =============================================

-- Tabela principal
create table if not exists public.reseller_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  email text not null,
  telefone text not null,
  cidade text,
  estado text,
  tipo_cadastro text check (tipo_cadastro in ('revendedor', 'multimarcas')),
  origem text not null default 'revenda' check (origem in ('revenda', 'primeiro-pedido')),
  status text not null default 'novo' check (status in ('novo', 'em_contato', 'convertido', 'descartado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indice para consultas frequentes
create index if not exists idx_reseller_leads_status on public.reseller_leads (status);
create index if not exists idx_reseller_leads_created on public.reseller_leads (created_at desc);
create index if not exists idx_reseller_leads_origem on public.reseller_leads (origem);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists reseller_leads_updated_at on public.reseller_leads;
create trigger reseller_leads_updated_at
  before update on public.reseller_leads
  for each row execute function public.set_updated_at();

-- =============================================
-- RLS
-- =============================================
alter table public.reseller_leads enable row level security;

-- INSERT: anon pode inserir (formulario publico do site)
do $$ begin
  create policy "reseller_leads_anon_insert"
    on public.reseller_leads for insert
    to anon
    with check (true);
exception when duplicate_object then null;
end $$;

-- SELECT: apenas usuarios autenticados (equipe interna)
do $$ begin
  create policy "reseller_leads_authenticated_select"
    on public.reseller_leads for select
    to authenticated
    using (true);
exception when duplicate_object then null;
end $$;

-- UPDATE: apenas usuarios autenticados (mudar status, adicionar notas)
do $$ begin
  create policy "reseller_leads_authenticated_update"
    on public.reseller_leads for update
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;

-- DELETE: apenas usuarios autenticados
do $$ begin
  create policy "reseller_leads_authenticated_delete"
    on public.reseller_leads for delete
    to authenticated
    using (true);
exception when duplicate_object then null;
end $$;
