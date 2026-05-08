-- Datas de publicação e expiração nos itens CMS
alter table public.cms_items
  add column published_at timestamptz,
  add column expires_at timestamptz;

create index idx_cms_items_published_at on public.cms_items(published_at);
create index idx_cms_items_expires_at on public.cms_items(expires_at);

-- Flag pra marcar collections que são apenas agrupadores (sem itens próprios)
alter table public.cms_collections
  add column is_group boolean not null default false;
