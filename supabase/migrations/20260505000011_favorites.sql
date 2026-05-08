-- Favorites table
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.cms_items(id) on delete cascade,
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, item_id)
);

create index idx_favorites_user on public.favorites(user_id, created_at desc);

-- RLS
alter table public.favorites enable row level security;

create policy "Users manage own favorites"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
