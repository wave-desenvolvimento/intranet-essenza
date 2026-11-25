-- 1. Perfis: franqueado le so a propria loja e a equipe da matriz (autores de comunicados etc.)
create or replace function public.my_franchise_id()
returns uuid language sql stable security definer set search_path = public as $$
  select franchise_id from profiles where id = auth.uid();
$$;
revoke execute on function public.my_franchise_id() from public, anon;
grant execute on function public.my_franchise_id() to authenticated, service_role;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_network_staff(auth.uid()))
    or franchise_id = (select public.my_franchise_id())
    or public.is_network_staff(id)
  );

-- 2. Permissoes do modulo (editaveis na tela Permissoes). Carga inicial:
-- acompanhar = quem ja via usuarios; configurar = Owner
insert into public.permissions (module, action, description) values
  ('treinamentos', 'view', 'Acompanhar treinamentos dos funcionarios'),
  ('treinamentos', 'manage', 'Configurar sequencia e certificado dos treinamentos')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, t.id
from public.role_permissions rp
join public.permissions p on p.id = rp.permission_id and p.module = 'usuarios' and p.action = 'view'
join public.permissions t on t.module = 'treinamentos' and t.action = 'view'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, t.id from public.roles r, public.permissions t
where r.slug = 'owner' and t.module = 'treinamentos'
on conflict do nothing;

-- Mesmo escopo de can_manage_user, para qualquer modulo
create or replace function public.can_access_user(_target uuid, _module text, _action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), _module, _action)
    and (
      public.is_network_staff(auth.uid())
      or (
        not public.is_network_staff(_target)
        and exists (
          select 1 from profiles me join profiles t on t.franchise_id = me.franchise_id
          where me.id = auth.uid() and t.id = _target
        )
      )
    );
$$;
create or replace function public.can_manage_user(_target uuid, _action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_user(_target, 'usuarios', _action);
$$;
revoke execute on function public.can_access_user(uuid, text, text) from public, anon;
grant execute on function public.can_access_user(uuid, text, text) to authenticated, service_role;

-- Funcionarios da minha loja (sem a matriz). Subselect no RLS: avaliado uma vez por consulta, nao por linha
create or replace function public.my_franchise_user_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from profiles p
  where p.franchise_id = public.my_franchise_id()
    and not exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = p.id and r.is_system);
$$;
revoke execute on function public.my_franchise_user_ids() from public, anon;
grant execute on function public.my_franchise_user_ids() to authenticated, service_role;

drop policy if exists "lesson_progress_select" on public.lesson_progress;
create policy "lesson_progress_select" on public.lesson_progress for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.has_permission(auth.uid(), 'treinamentos', 'view'))
      and ((select public.is_network_staff(auth.uid())) or user_id in (select public.my_franchise_user_ids()))
    )
  );

insert into public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module, required_action)
select 'Acompanhamento', 'acompanhamento', 'bar-chart', coalesce(p.sort_order, 0) + 50, p.parent_id, 'system', '/acompanhamento', 'treinamentos', 'view'
from (select 1) x left join public.cms_pages p on p.slug = 'treinamento'
where not exists (select 1 from public.cms_pages where slug = 'acompanhamento');

-- 3. Certificados
alter table public.cms_pages add column if not exists certificate boolean not null default false;

create table if not exists public.course_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_slug text not null,
  user_name text not null,
  training_title text not null,
  issued_at timestamptz not null default now(),
  unique (user_id, page_slug)
);
alter table public.course_certificates enable row level security;
drop policy if exists "course_certificates_select" on public.course_certificates;
create policy "course_certificates_select" on public.course_certificates for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.has_permission(auth.uid(), 'treinamentos', 'view'))
      and ((select public.is_network_staff(auth.uid())) or user_id in (select public.my_franchise_user_ids()))
    )
  );
revoke insert, update, delete on public.course_certificates from anon, authenticated;
grant select on public.course_certificates to authenticated;

-- Emite para quem concluiu todas as aulas publicadas. Interna: so as funcoes abaixo chamam.
create or replace function public.issue_course_certificates(_page_slug text, _user_id uuid default null)
returns void language sql security definer set search_path = public as $$
  with lessons as (
    select v.id from course_videos v join course_modules m on m.id = v.module_id
    where m.page_slug = _page_slug and m.status = 'published' and v.status = 'published'
  )
  insert into course_certificates (user_id, page_slug, user_name, training_title)
  select lp.user_id, _page_slug, p.full_name, pg.title
  from lesson_progress lp
  join lessons l on l.id = lp.video_id
  join profiles p on p.id = lp.user_id
  join cms_pages pg on pg.slug = _page_slug and pg.certificate
  where lp.completed_at is not null and (_user_id is null or lp.user_id = _user_id)
  group by lp.user_id, p.full_name, pg.title
  having count(*) = (select count(*) from lessons)
  on conflict (user_id, page_slug) do nothing;
$$;
revoke execute on function public.issue_course_certificates(text, uuid) from public, anon, authenticated;

create or replace function public.save_lesson_progress(p_video_id uuid, p_watched_pct smallint)
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
  if p_watched_pct >= 95 then
    perform public.issue_course_certificates(
      (select m.page_slug from course_videos v join course_modules m on m.id = v.module_id where v.id = p_video_id),
      auth.uid());
  end if;
end;
$$;

-- 4. Configuracao por treinamento
create or replace function public.set_course_settings(_page_slug text, _sequential boolean, _certificate boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(auth.uid(), 'treinamentos', 'manage') then
    raise exception 'Sem permissao para configurar treinamentos';
  end if;
  update cms_pages set sequential = _sequential, certificate = _certificate where slug = _page_slug;
  if not found then raise exception 'Treinamento nao encontrado'; end if;
  perform public.issue_course_certificates(_page_slug);
end;
$$;
revoke execute on function public.set_course_settings(text, boolean, boolean) from public, anon;
grant execute on function public.set_course_settings(text, boolean, boolean) to authenticated;

-- 5. Resumo de treinamentos por funcionario (so franqueados, so o que o perfil pode abrir). Security definer por desempenho
-- (RLS por linha nao escala com a rede): o escopo e aplicado em people. Json unico evita o teto de linhas do PostgREST.
create or replace function public.training_overview(_franchise_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with lessons as (
    select v.id, m.page_slug
    from course_videos v join course_modules m on m.id = v.module_id
    where v.status = 'published' and m.status = 'published'
  ),
  trainings as (
    select l.page_slug as slug, p.title, p.sort_order, count(*) as total
    from lessons l join cms_pages p on p.slug = l.page_slug
    group by 1, 2, 3
  ),
  people as (
    select p.id, p.full_name, p.franchise_id, f.name as franchise_name
    from profiles p left join franchises f on f.id = p.franchise_id
    where p.status = 'active'
      and (_franchise_id is null or p.franchise_id = _franchise_id)
      and (select public.has_permission(auth.uid(), 'treinamentos', 'view'))
      and ((select public.is_network_staff(auth.uid())) or p.franchise_id = (select public.my_franchise_id()))
      and not exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = p.id and r.is_system)
  ),
  available as (
    select distinct pe.id as user_id, t.slug
    from people pe
    join user_roles ur on ur.user_id = pe.id
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions pm on pm.id = rp.permission_id
    join trainings t on t.slug = pm.module
  ),
  progress as (
    select lp.user_id, l.page_slug,
      count(*) filter (where lp.completed_at is not null) as done,
      count(*) filter (where lp.completed_at is null and lp.watched_pct > 0) as started,
      max(lp.updated_at) as last_at
    from lesson_progress lp join lessons l on l.id = lp.video_id
    join available a on a.user_id = lp.user_id and a.slug = l.page_slug
    group by 1, 2
  ),
  progress_json as (
    select user_id, jsonb_object_agg(page_slug, jsonb_build_object('done', done, 'started', started, 'lastAt', last_at)) as data
    from progress group by 1
  ),
  available_json as (
    select user_id, jsonb_agg(slug) as data from available group by 1
  ),
  certificates_json as (
    select user_id, jsonb_agg(page_slug) as data from course_certificates group by 1
  )
  select jsonb_build_object(
    'trainings', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'title', title, 'total', total) order by sort_order, title) from trainings), '[]'),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id, 'name', pe.full_name, 'franchiseId', pe.franchise_id, 'franchiseName', pe.franchise_name,
        'certificates', coalesce(c.data, '[]'), 'available', coalesce(a.data, '[]'), 'progress', coalesce(pr.data, '{}')
      ) order by pe.full_name)
      from people pe
      left join progress_json pr on pr.user_id = pe.id
      left join available_json a on a.user_id = pe.id
      left join certificates_json c on c.user_id = pe.id
    ), '[]')
  );
$$;
revoke execute on function public.training_overview(uuid) from public, anon;
grant execute on function public.training_overview(uuid) to authenticated;
