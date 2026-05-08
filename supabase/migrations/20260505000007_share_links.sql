-- Links de compartilhamento com expiração
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  signed_url text not null,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_share_links_code on public.share_links(code);

-- Cleanup: permitir leitura pública (rota /s/[code] não é autenticada)
alter table public.share_links enable row level security;

-- Qualquer um pode ler (pra rota pública funcionar)
create policy "share_links_select_public" on public.share_links
  for select using (true);

-- Só autenticado cria
create policy "share_links_insert" on public.share_links
  for insert to authenticated with check (true);
