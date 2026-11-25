-- Escopo de usuarios: perfil "Sistema" (matriz) alcanca a rede toda; perfil "Franquia" so a propria loja.

create or replace function public.is_network_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = _user_id and r.is_system
  );
$$;

create or replace function public.can_manage_user(_target uuid, _action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), 'usuarios', _action)
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

revoke execute on function public.is_network_staff(uuid), public.can_manage_user(uuid, text) from public, anon;
grant execute on function public.is_network_staff(uuid), public.can_manage_user(uuid, text) to authenticated, service_role;

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (auth.uid() = id or public.can_manage_user(id, 'edit'));

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete to authenticated
  using (public.can_manage_user(id, 'delete'));

-- O usuario edita o proprio perfil, mas nao pode trocar de loja nem se promover
create or replace function public.guard_profile_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_network_staff(auth.uid()) then return new; end if;
  if new.franchise_id is distinct from old.franchise_id
    or (old.id = auth.uid() and (
      new.is_franchise_admin is distinct from old.is_franchise_admin
      or new.status is distinct from old.status))
  then
    raise exception 'Sem permissao para alterar franquia, status ou admin do perfil';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_scope on public.profiles;
create trigger guard_profile_scope before update on public.profiles
  for each row execute function public.guard_profile_scope();

drop policy if exists "user_roles_insert" on public.user_roles;
create policy "user_roles_insert" on public.user_roles for insert to authenticated
  with check (
    public.is_owner(auth.uid())
    or (
      public.can_manage_user(user_id, 'manage')
      and public.get_user_role_level(auth.uid()) >= (select level from public.roles where id = role_id)
      and (public.is_network_staff(auth.uid()) or not (select is_system from public.roles where id = role_id))
    )
  );

drop policy if exists "user_roles_delete" on public.user_roles;
create policy "user_roles_delete" on public.user_roles for delete to authenticated
  using (
    public.is_owner(auth.uid())
    or (
      public.can_manage_user(user_id, 'manage')
      and public.get_user_role_level(auth.uid()) >= (select level from public.roles where id = role_id)
    )
  );

insert into public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module, required_action)
select 'Usuários', 'usuarios', 'users', 901, (select id from public.cms_pages where slug = 'administracao'),
  'system', '/usuarios', 'usuarios', 'view'
where not exists (select 1 from public.cms_pages where slug = 'usuarios');

-- Painel de treinamentos por funcionario
drop policy if exists "lesson_progress_select" on public.lesson_progress;
create policy "lesson_progress_select" on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id or public.can_manage_user(user_id, 'view'));
