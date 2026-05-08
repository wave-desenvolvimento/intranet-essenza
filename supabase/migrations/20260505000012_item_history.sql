-- Item history / versioning
create table public.cms_item_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.cms_items(id) on delete cascade,
  data jsonb not null,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  action text not null default 'update', -- 'create', 'update', 'status_change'
  created_at timestamptz not null default now()
);

create index idx_item_history_item on public.cms_item_history(item_id, created_at desc);

-- RLS
alter table public.cms_item_history enable row level security;

create policy "Authenticated users can read history"
  on public.cms_item_history for select
  to authenticated
  using (true);

-- Trigger to auto-save history on item update
create or replace function public.save_item_history()
returns trigger
language plpgsql
security definer
as $$
declare
  user_name text;
begin
  -- Get user name
  select full_name into user_name
  from public.profiles
  where id = auth.uid();

  -- Determine action type
  if tg_op = 'INSERT' then
    insert into public.cms_item_history (item_id, data, status, changed_by, changed_by_name, action)
    values (new.id, new.data, new.status, auth.uid(), user_name, 'create');
  elsif old.data is distinct from new.data then
    insert into public.cms_item_history (item_id, data, status, changed_by, changed_by_name, action)
    values (new.id, old.data, old.status, auth.uid(), user_name, 'update');
  elsif old.status is distinct from new.status then
    insert into public.cms_item_history (item_id, data, status, changed_by, changed_by_name, action)
    values (new.id, old.data, old.status, auth.uid(), user_name, 'status_change');
  end if;

  return new;
end;
$$;

create trigger trg_save_item_history
  after insert or update on public.cms_items
  for each row
  execute function public.save_item_history();
