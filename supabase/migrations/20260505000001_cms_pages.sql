-- Pages (navegação + layout)
create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  icon text default 'file',
  view_type text not null default 'table' check (view_type in ('table', 'gallery', 'files', 'course', 'custom')),
  parent_id uuid references public.cms_pages(id) on delete set null,
  is_group boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cms_pages_updated_at
  before update on public.cms_pages
  for each row execute function public.set_updated_at();

create index idx_cms_pages_parent on public.cms_pages(parent_id);
create index idx_cms_pages_slug on public.cms_pages(slug);

-- Junction: page <-> collection (uma page pode ter várias collections como fonte)
create table public.cms_page_collections (
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  role text not null default 'main' check (role in ('main', 'filter', 'secondary')),
  sort_order int not null default 0,
  primary key (page_id, collection_id)
);

-- Auto-slug
create trigger cms_page_auto_slug
  before insert on public.cms_pages
  for each row execute function public.generate_cms_collection_slug();

-- RLS
alter table public.cms_pages enable row level security;
alter table public.cms_page_collections enable row level security;

create policy "pages_select" on public.cms_pages for select to authenticated using (true);
create policy "pages_insert" on public.cms_pages for insert to authenticated with check (true);
create policy "pages_update" on public.cms_pages for update to authenticated using (true);
create policy "pages_delete" on public.cms_pages for delete to authenticated using (true);

create policy "page_collections_select" on public.cms_page_collections for select to authenticated using (true);
create policy "page_collections_insert" on public.cms_page_collections for insert to authenticated with check (true);
create policy "page_collections_update" on public.cms_page_collections for update to authenticated using (true);
create policy "page_collections_delete" on public.cms_page_collections for delete to authenticated using (true);

-- Limpar campos de navegação das collections (não são mais usados pra sidebar)
-- parent_id e is_group nas collections continuam existindo pra hierarquia de dados
-- mas view_type não faz mais sentido nas collections
