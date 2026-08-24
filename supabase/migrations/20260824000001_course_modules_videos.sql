-- Tabelas dedicadas para cursos: modulos e videos
-- Substitui o uso de cms_items/cms_collections para conteudo de curso

-- Modulos de curso (ex: "Universo da Marca", "Treinamento Vendas")
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,
  slug text not null unique,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger course_modules_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

-- RLS: leitura para authenticated, escrita para admin (via service role ou permissoes)
alter table public.course_modules enable row level security;

create policy "course_modules_select" on public.course_modules
  for select to authenticated using (true);

create policy "course_modules_insert" on public.course_modules
  for insert to authenticated with check (true);

create policy "course_modules_update" on public.course_modules
  for update to authenticated using (true);

create policy "course_modules_delete" on public.course_modules
  for delete to authenticated using (true);

-- Videos de curso
create table public.course_videos (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  description text,
  source_type text not null default 'youtube' check (source_type in ('upload', 'youtube', 'external')),
  video_url text, -- YouTube/external URL
  storage_path text, -- path no bucket course-videos (upload)
  thumbnail_url text,
  duration_seconds int,
  size_bytes bigint,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger course_videos_updated_at
  before update on public.course_videos
  for each row execute function public.set_updated_at();

create index idx_course_videos_module on public.course_videos(module_id);
create index idx_course_videos_sort on public.course_videos(module_id, sort_order);

alter table public.course_videos enable row level security;

create policy "course_videos_select" on public.course_videos
  for select to authenticated using (true);

create policy "course_videos_insert" on public.course_videos
  for insert to authenticated with check (true);

create policy "course_videos_update" on public.course_videos
  for update to authenticated using (true);

create policy "course_videos_delete" on public.course_videos
  for delete to authenticated using (true);

-- Migrar lesson_progress: adicionar video_id e module_id, depreciar item_id e collection_id
alter table public.lesson_progress
  add column video_id uuid references public.course_videos(id) on delete cascade,
  add column module_id uuid references public.course_modules(id) on delete cascade;

-- Tornar item_id e collection_id nullable (dados legados)
alter table public.lesson_progress
  alter column item_id drop not null,
  alter column collection_id drop not null;

-- Unique constraint para novo modelo
create unique index idx_lesson_progress_user_video
  on public.lesson_progress(user_id, video_id)
  where video_id is not null;

create index idx_lesson_progress_module on public.lesson_progress(user_id, module_id);

-- Atualizar RPC de upsert para suportar novo modelo
create or replace function public.upsert_lesson_progress(
  p_user_id uuid,
  p_item_id uuid default null,
  p_collection_id uuid default null,
  p_watched_pct smallint default 0,
  p_completed_at timestamptz default null,
  p_video_id uuid default null,
  p_module_id uuid default null
) returns void as $$
begin
  if p_video_id is not null then
    -- Novo modelo: course_videos
    insert into public.lesson_progress (user_id, video_id, module_id, watched_pct, completed_at)
    values (p_user_id, p_video_id, p_module_id, p_watched_pct, p_completed_at)
    on conflict (user_id, video_id) where video_id is not null
    do update set
      watched_pct = greatest(lesson_progress.watched_pct, excluded.watched_pct),
      completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at);
  elsif p_item_id is not null then
    -- Modelo legado: cms_items
    insert into public.lesson_progress (user_id, item_id, collection_id, watched_pct, completed_at)
    values (p_user_id, p_item_id, p_collection_id, p_watched_pct, p_completed_at)
    on conflict (user_id, item_id)
    do update set
      watched_pct = greatest(lesson_progress.watched_pct, excluded.watched_pct),
      completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at);
  end if;
end;
$$ language plpgsql security definer;

-- Atualizar a pagina universo-da-marca para ser system com href dedicado
update public.cms_pages
set page_type = 'system',
    href = '/cursos',
    view_type = 'custom'
where slug = 'universo-da-marca';

-- Adicionar check 'custom' ao view_type se nao existir
alter table public.cms_pages drop constraint if exists cms_collections_view_type_check;
alter table public.cms_pages drop constraint if exists cms_pages_view_type_check;

do $$
begin
  -- Tenta dropar qualquer constraint de check no view_type
  execute (
    select 'alter table public.cms_pages drop constraint ' || quote_ident(conname)
    from pg_constraint
    where conrelid = 'public.cms_pages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%view_type%'
    limit 1
  );
exception when others then null;
end $$;

alter table public.cms_pages
  add constraint cms_pages_view_type_check
  check (view_type in ('table', 'gallery', 'files', 'course', 'custom'));

-- Permissoes para o modulo universo-da-marca ja existem, so precisamos garantir as acoes certas
-- As permissoes existentes (view, create, edit, download) continuam validas
