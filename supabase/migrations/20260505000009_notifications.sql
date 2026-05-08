-- Notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  href text,
  icon text default 'bell',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Function to notify all active users when a CMS item is published
create or replace function public.notify_on_publish()
returns trigger
language plpgsql
security definer
as $$
declare
  collection_name text;
  item_title text;
  page_slug text;
  r record;
begin
  -- Only fire when status changes TO published
  if new.status <> 'published' then return new; end if;
  if old is not null and old.status = 'published' then return new; end if;

  -- Get collection info
  select c.name, p.slug into collection_name, page_slug
  from public.cms_collections c
  left join public.cms_page_collections pc on pc.collection_id = c.id
  left join public.cms_pages p on p.id = pc.page_id
  where c.id = new.collection_id
  limit 1;

  -- Try to extract title from item data
  item_title := coalesce(
    new.data->>'titulo',
    new.data->>'title',
    new.data->>'nome',
    new.data->>'name',
    'Novo conteúdo'
  );

  -- Notify all active users (except the one who published)
  for r in
    select id from public.profiles
    where status = 'active'
      and id is distinct from new.created_by
  loop
    insert into public.notifications (user_id, title, body, href, icon)
    values (
      r.id,
      coalesce(collection_name, 'CMS') || ': ' || item_title,
      'Novo conteúdo publicado',
      case when page_slug is not null then '/p/' || page_slug else '/cms' end,
      'megaphone'
    );
  end loop;

  return new;
end;
$$;

-- Trigger on insert and update
create trigger trg_notify_on_publish
  after insert or update of status on public.cms_items
  for each row
  execute function public.notify_on_publish();

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
