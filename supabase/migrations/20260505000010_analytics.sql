-- Analytics events table
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  franchise_id uuid references public.franchises(id) on delete set null,
  item_id uuid references public.cms_items(id) on delete cascade,
  collection_id uuid references public.cms_collections(id) on delete cascade,
  event_type text not null, -- 'view', 'download'
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_analytics_item on public.analytics_events(item_id, event_type);
create index idx_analytics_franchise on public.analytics_events(franchise_id, event_type);
create index idx_analytics_user on public.analytics_events(user_id, event_type);
create index idx_analytics_date on public.analytics_events(created_at);

-- RLS
alter table public.analytics_events enable row level security;

-- Anyone authenticated can insert (track own events)
create policy "Authenticated users can insert analytics"
  on public.analytics_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only admins can read all analytics
create policy "Admins can read analytics"
  on public.analytics_events for select
  using (
    exists (
      select 1 from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id
      where p.id = auth.uid() and r.name in ('admin', 'superadmin')
    )
  );

-- Materialized view for fast dashboard queries
create or replace view public.analytics_summary as
select
  ae.collection_id,
  ae.item_id,
  ae.event_type,
  ae.franchise_id,
  f.name as franchise_name,
  c.name as collection_name,
  date_trunc('day', ae.created_at) as event_date,
  count(*) as event_count
from public.analytics_events ae
left join public.franchises f on f.id = ae.franchise_id
left join public.cms_collections c on c.id = ae.collection_id
group by ae.collection_id, ae.item_id, ae.event_type, ae.franchise_id, f.name, c.name, date_trunc('day', ae.created_at);
