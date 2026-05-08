-- CMS Collections (estrutura de categorias)
create table public.cms_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text default 'folder',
  parent_id uuid references public.cms_collections(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cms_collections_updated_at
  before update on public.cms_collections
  for each row execute function public.set_updated_at();

create index idx_cms_collections_parent on public.cms_collections(parent_id);
create index idx_cms_collections_slug on public.cms_collections(slug);

-- CMS Fields (campos customizados por collection)
create table public.cms_fields (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  name text not null,
  slug text not null,
  field_type text not null check (field_type in (
    'text', 'textarea', 'rich_text', 'number',
    'boolean', 'date', 'datetime',
    'select', 'multi_select',
    'image', 'file', 'url', 'color', 'email'
  )),
  required boolean not null default false,
  options jsonb, -- para select/multi_select: [{value, label}], para number: {min, max}, etc.
  default_value jsonb,
  placeholder text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, slug)
);

create index idx_cms_fields_collection on public.cms_fields(collection_id);

-- CMS Items (entradas em cada collection)
create table public.cms_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  data jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cms_items_updated_at
  before update on public.cms_items
  for each row execute function public.set_updated_at();

create index idx_cms_items_collection on public.cms_items(collection_id);
create index idx_cms_items_status on public.cms_items(status);

-- Auto-generate slug for collections
create or replace function public.generate_cms_collection_slug()
returns trigger as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(
      regexp_replace(
        regexp_replace(
          translate(new.name, 'áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
          '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      )
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger cms_collection_auto_slug
  before insert on public.cms_collections
  for each row execute function public.generate_cms_collection_slug();

-- RLS
alter table public.cms_collections enable row level security;
alter table public.cms_fields enable row level security;
alter table public.cms_items enable row level security;

-- Read: authenticated
create policy "cms_collections_select" on public.cms_collections for select to authenticated using (true);
create policy "cms_fields_select" on public.cms_fields for select to authenticated using (true);
create policy "cms_items_select" on public.cms_items for select to authenticated using (true);

-- Write: authenticated (permission check via app layer)
create policy "cms_collections_insert" on public.cms_collections for insert to authenticated with check (true);
create policy "cms_collections_update" on public.cms_collections for update to authenticated using (true);
create policy "cms_collections_delete" on public.cms_collections for delete to authenticated using (true);
create policy "cms_fields_insert" on public.cms_fields for insert to authenticated with check (true);
create policy "cms_fields_update" on public.cms_fields for update to authenticated using (true);
create policy "cms_fields_delete" on public.cms_fields for delete to authenticated using (true);
create policy "cms_items_insert" on public.cms_items for insert to authenticated with check (true);
create policy "cms_items_update" on public.cms_items for update to authenticated using (true);
create policy "cms_items_delete" on public.cms_items for delete to authenticated using (true);
