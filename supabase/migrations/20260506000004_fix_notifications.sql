-- Fix notify_on_publish to use /pagina/ instead of /p/
-- Also add INSERT policy so server actions can create notifications

-- Allow authenticated users to insert notifications (server actions need this)
create policy "Service can insert notifications"
  on public.notifications for insert
  with check (true);

-- Fix the trigger function href
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
    'Novo conteudo'
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
      'Novo conteudo publicado',
      case when page_slug is not null then '/pagina/' || page_slug else '/cms' end,
      'megaphone'
    );
  end loop;

  return new;
end;
$$;
