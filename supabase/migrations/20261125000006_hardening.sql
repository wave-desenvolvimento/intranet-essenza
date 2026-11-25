-- Usuario inativo perde todas as permissoes na hora (antes o status nao bloqueava nada)
create or replace function public.is_active_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = _user_id and status = 'active');
$$;
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;

create or replace function public.has_permission(_user_id uuid, _module text, _action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user(_user_id) and (
    public.is_owner(_user_id)
    or exists (
      select 1
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p on p.id = rp.permission_id
      where ur.user_id = _user_id and p.module = _module and p.action = _action
    )
  );
$$;

create or replace function public.has_permission(_module text, _action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(auth.uid(), _module, _action);
$$;

create or replace function public.get_user_permissions(_user_id uuid)
returns table (module text, action text) language sql stable security definer set search_path = public as $$
  select distinct p.module, p.action
  from permissions p
  where public.is_active_user(_user_id) and (
    public.is_owner(_user_id)
    or exists (
      select 1 from user_roles ur join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = _user_id and rp.permission_id = p.id
    )
  );
$$;

create or replace function public.my_franchise_id()
returns uuid language sql stable security definer set search_path = public as $$
  select franchise_id from profiles where id = auth.uid() and status = 'active';
$$;

-- Pedido so com a permissao
drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders for insert to authenticated
  with check (public.has_permission(auth.uid(), 'pedidos', 'create') and franchise_id = (select public.my_franchise_id()));

-- Links compartilhados: o codigo e resolvido no servidor; ninguem lista os links
drop policy if exists "share_links_select_public" on public.share_links;
drop policy if exists "share_links_select_own" on public.share_links;
create policy "share_links_select_own" on public.share_links for select to authenticated
  using (created_by = auth.uid());
