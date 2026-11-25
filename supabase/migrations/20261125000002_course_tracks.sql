-- Modulos de curso por pagina de treinamento + sequencia obrigatoria opcional

-- shortcut: page_slug sem FK (permissoes ja sao por slug), rever se slugs passarem a ser renomeados
alter table public.course_modules add column page_slug text not null default 'universo-da-marca';
create index idx_course_modules_page on public.course_modules(page_slug, sort_order);

alter table public.cms_pages add column sequential boolean not null default false;
update public.cms_pages set sequential = true where slug = 'treinamento';

create or replace function public.can_edit_course_page(_page_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), _page_slug, 'edit')
      or public.has_permission(auth.uid(), _page_slug, 'create');
$$;

create or replace function public.can_edit_any_course()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), 'cms', 'edit') or exists (
    select 1 from cms_pages p
    where (p.view_type = 'course' or p.slug = 'universo-da-marca')
      and public.can_edit_course_page(p.slug)
  );
$$;

-- Publicado e, se a pagina for sequencial, com todas as aulas anteriores da pagina concluidas
create or replace function public.course_video_unlocked(_video_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from course_videos v join course_modules m on m.id = v.module_id
    where v.id = _video_id and v.status = 'published' and m.status = 'published'
      and exists (select 1 from get_user_permissions(auth.uid()) gp where gp.module = m.page_slug)
      and (
        not coalesce((select p.sequential from cms_pages p where p.slug = m.page_slug), false)
        or not exists (
          select 1
          from course_videos pv join course_modules pm on pm.id = pv.module_id
          where pm.page_slug = m.page_slug and pm.status = 'published' and pv.status = 'published'
            and (pm.sort_order, pm.id, pv.sort_order, pv.id) < (m.sort_order, m.id, v.sort_order, v.id)
            and not exists (
              select 1 from lesson_progress lp
              where lp.user_id = auth.uid() and lp.video_id = pv.id and lp.completed_at is not null
            )
        )
      )
  );
$$;

revoke execute on function public.can_edit_course_page(text), public.can_edit_any_course(), public.course_video_unlocked(uuid) from public, anon;
grant execute on function public.can_edit_course_page(text), public.can_edit_any_course(), public.course_video_unlocked(uuid) to authenticated, service_role;

-- RLS de escrita (antes: qualquer autenticado)
drop policy if exists "course_modules_insert" on public.course_modules;
drop policy if exists "course_modules_update" on public.course_modules;
drop policy if exists "course_modules_delete" on public.course_modules;
create policy "course_modules_insert" on public.course_modules for insert to authenticated
  with check (public.can_edit_course_page(page_slug));
create policy "course_modules_update" on public.course_modules for update to authenticated
  using (public.can_edit_course_page(page_slug)) with check (public.can_edit_course_page(page_slug));
create policy "course_modules_delete" on public.course_modules for delete to authenticated
  using (public.can_edit_course_page(page_slug));

drop policy if exists "course_videos_insert" on public.course_videos;
drop policy if exists "course_videos_update" on public.course_videos;
drop policy if exists "course_videos_delete" on public.course_videos;
create policy "course_videos_insert" on public.course_videos for insert to authenticated
  with check (exists (select 1 from public.course_modules m where m.id = module_id and public.can_edit_course_page(m.page_slug)));
create policy "course_videos_update" on public.course_videos for update to authenticated
  using (exists (select 1 from public.course_modules m where m.id = module_id and public.can_edit_course_page(m.page_slug)))
  with check (exists (select 1 from public.course_modules m where m.id = module_id and public.can_edit_course_page(m.page_slug)));
create policy "course_videos_delete" on public.course_videos for delete to authenticated
  using (exists (select 1 from public.course_modules m where m.id = module_id and public.can_edit_course_page(m.page_slug)));

drop policy if exists "course_videos_auth_select" on storage.objects;
drop policy if exists "course_videos_auth_insert" on storage.objects;
drop policy if exists "course_videos_auth_update" on storage.objects;
drop policy if exists "course_videos_auth_delete" on storage.objects;
create policy "course_videos_auth_select" on storage.objects for select to authenticated
  using (bucket_id = 'course-videos' and (
    public.can_edit_any_course()
    or exists (select 1 from public.course_videos v where v.storage_path = name and public.course_video_unlocked(v.id))
  ));
create policy "course_videos_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-videos' and public.can_edit_any_course());
create policy "course_videos_auth_update" on storage.objects for update to authenticated
  using (bucket_id = 'course-videos' and public.can_edit_any_course());
create policy "course_videos_auth_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-videos' and public.can_edit_any_course());

-- Progresso so via RPC: sempre do proprio usuario e so de aula liberada
drop policy if exists "lesson_progress_insert" on public.lesson_progress;
drop policy if exists "lesson_progress_update" on public.lesson_progress;
drop function if exists public.upsert_lesson_progress(uuid, uuid, uuid, smallint, timestamptz);
drop function if exists public.upsert_lesson_progress(uuid, uuid, uuid, smallint, timestamptz, uuid, uuid);

create function public.save_lesson_progress(p_video_id uuid, p_watched_pct smallint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.course_video_unlocked(p_video_id) then
    raise exception 'Aula bloqueada';
  end if;
  insert into lesson_progress (user_id, video_id, module_id, watched_pct, completed_at)
  select auth.uid(), v.id, v.module_id, p_watched_pct, case when p_watched_pct >= 95 then now() end
  from course_videos v where v.id = p_video_id
  on conflict (user_id, video_id) where video_id is not null
  do update set
    watched_pct = greatest(lesson_progress.watched_pct, excluded.watched_pct),
    completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at);
end;
$$;
revoke execute on function public.save_lesson_progress(uuid, smallint) from public, anon;
grant execute on function public.save_lesson_progress(uuid, smallint) to authenticated;

-- Migra as aulas publicadas do CMS. Os itens originais ficam intactos.
-- Sem video (ex.: Royalties) entra como rascunho, para receber o upload.
insert into public.course_modules (title, slug, page_slug, status)
select distinct p.title, p.slug, p.slug, 'published'
from public.cms_pages p
join public.cms_page_collections pc on pc.page_id = p.id and pc.role = 'main'
join public.cms_items i on i.collection_id = pc.collection_id and i.status = 'published'
where p.view_type = 'course' and p.slug <> 'universo-da-marca'
on conflict (slug) do nothing;

create temp table _lesson_map on commit drop as
select gen_random_uuid() as video_id, i.id as item_id, m.id as module_id, i.sort_order,
  i.data->>tf.slug as title, i.data->>df.slug as description, nullif(i.data->>uf.slug, '') as url
from public.cms_pages p
join public.course_modules m on m.slug = p.slug and m.page_slug = p.slug
join public.cms_page_collections pc on pc.page_id = p.id and pc.role = 'main'
join public.cms_items i on i.collection_id = pc.collection_id and i.status = 'published'
left join lateral (select slug from public.cms_fields f where f.collection_id = i.collection_id and f.field_type = 'text' order by sort_order limit 1) tf on true
left join lateral (select slug from public.cms_fields f where f.collection_id = i.collection_id and (f.field_type in ('textarea', 'rich_text') or f.slug = 'descricao') order by sort_order limit 1) df on true
left join lateral (select slug from public.cms_fields f where f.collection_id = i.collection_id and f.field_type = 'url' order by sort_order limit 1) uf on true
where p.view_type = 'course' and p.slug <> 'universo-da-marca';

insert into public.course_videos (id, module_id, title, description, source_type, video_url, storage_path, sort_order, status)
select video_id, module_id, coalesce(nullif(title, ''), 'Aula'), description,
  case when url ~* 'youtu\.?be' then 'youtube' when url ~* '^(https?:)?//' then 'external' else 'upload' end,
  case when url ~* '^(https?:)?//' then url end,
  case when url !~* '^(https?:)?//' then url end,
  sort_order,
  case when url is null then 'draft' else 'published' end
from _lesson_map;

insert into public.lesson_progress (user_id, video_id, module_id, watched_pct, completed_at)
select lp.user_id, x.video_id, x.module_id, lp.watched_pct, lp.completed_at
from public.lesson_progress lp join _lesson_map x on x.item_id = lp.item_id
where x.url is not null;
