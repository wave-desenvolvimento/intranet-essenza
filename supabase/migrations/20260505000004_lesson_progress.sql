-- Progresso de aulas por usuario
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.cms_items(id) on delete cascade,
  collection_id uuid not null references public.cms_collections(id) on delete cascade,
  watched_pct smallint not null default 0 check (watched_pct between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create trigger lesson_progress_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

create index idx_lesson_progress_user on public.lesson_progress(user_id);
create index idx_lesson_progress_collection on public.lesson_progress(user_id, collection_id);

-- RLS: usuario so ve/edita o proprio progresso
alter table public.lesson_progress enable row level security;

create policy "lesson_progress_select" on public.lesson_progress
  for select to authenticated
  using (auth.uid() = user_id);

create policy "lesson_progress_insert" on public.lesson_progress
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "lesson_progress_update" on public.lesson_progress
  for update to authenticated
  using (auth.uid() = user_id);

-- RPC: upsert atomico que nunca reduz progresso
create or replace function public.upsert_lesson_progress(
  p_user_id uuid,
  p_item_id uuid,
  p_collection_id uuid,
  p_watched_pct smallint,
  p_completed_at timestamptz default null
) returns void as $$
begin
  insert into public.lesson_progress (user_id, item_id, collection_id, watched_pct, completed_at)
  values (p_user_id, p_item_id, p_collection_id, p_watched_pct, p_completed_at)
  on conflict (user_id, item_id)
  do update set
    watched_pct = greatest(lesson_progress.watched_pct, excluded.watched_pct),
    completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at);
end;
$$ language plpgsql security definer;
