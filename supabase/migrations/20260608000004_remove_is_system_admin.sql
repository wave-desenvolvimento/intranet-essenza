-- =============================================
-- Remover is_system_admin() — tudo via has_permission()
-- has_permission() agora usa auth.uid() internamente
-- Manter versão com _user_id pra retrocompat temporária
-- =============================================

-- 1. Criar nova has_permission que usa auth.uid() (sem parâmetro de user)
create or replace function public.has_permission(_module text, _action text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.module = _module and p.action = _action
  );
end;
$$;

-- 2. Manter versão com _user_id mas forçar auth.uid() (ignora parâmetro)
create or replace function public.has_permission(_user_id uuid, _module text, _action text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.module = _module and p.action = _action
  );
end;
$$;

-- 3. Substituir todas as policies que usam is_system_admin()

-- roles
drop policy if exists "roles_insert" on public.roles;
drop policy if exists "roles_update" on public.roles;
drop policy if exists "roles_delete" on public.roles;

create policy "roles_insert" on public.roles for insert to authenticated
  with check (has_permission('configuracoes', 'edit'));
create policy "roles_update" on public.roles for update to authenticated
  using (has_permission('configuracoes', 'edit'));
create policy "roles_delete" on public.roles for delete to authenticated
  using (has_permission('configuracoes', 'edit') and is_system = false);

-- permissions
drop policy if exists "permissions_insert" on public.permissions;
drop policy if exists "permissions_update" on public.permissions;
drop policy if exists "permissions_delete" on public.permissions;

create policy "permissions_insert" on public.permissions for insert to authenticated
  with check (has_permission('configuracoes', 'edit'));
create policy "permissions_update" on public.permissions for update to authenticated
  using (has_permission('configuracoes', 'edit'));
create policy "permissions_delete" on public.permissions for delete to authenticated
  using (has_permission('configuracoes', 'edit'));

-- role_permissions
drop policy if exists "role_permissions_insert" on public.role_permissions;
drop policy if exists "role_permissions_delete" on public.role_permissions;

create policy "role_permissions_insert" on public.role_permissions for insert to authenticated
  with check (has_permission('configuracoes', 'edit'));
create policy "role_permissions_delete" on public.role_permissions for delete to authenticated
  using (has_permission('configuracoes', 'edit'));

-- payment_plans
drop policy if exists "payment_plans_manage" on public.payment_plans;
create policy "payment_plans_manage" on public.payment_plans for all to authenticated
  using (has_permission('pedidos', 'manage'))
  with check (has_permission('pedidos', 'manage'));

-- shipping_types
drop policy if exists "shipping_types_manage" on public.shipping_types;
create policy "shipping_types_manage" on public.shipping_types for all to authenticated
  using (has_permission('pedidos', 'manage'))
  with check (has_permission('pedidos', 'manage'));

-- webhook_config
drop policy if exists "webhook_config_admin" on public.webhook_config;
create policy "webhook_config_admin" on public.webhook_config for all to authenticated
  using (has_permission('pedidos', 'manage'))
  with check (has_permission('pedidos', 'manage'));

-- webhook_queue
drop policy if exists "webhook_queue_admin" on public.webhook_queue;
create policy "webhook_queue_admin" on public.webhook_queue for all to authenticated
  using (has_permission('pedidos', 'manage'))
  with check (has_permission('pedidos', 'manage'));

-- monitors
drop policy if exists "Admins manage monitors" on public.monitors;
create policy "monitors_manage" on public.monitors for all to authenticated
  using (has_permission('configuracoes', 'edit'))
  with check (has_permission('configuracoes', 'edit'));

-- status_reports
drop policy if exists "Admins read status_reports" on public.status_reports;
create policy "status_reports_select" on public.status_reports for select to authenticated
  using (has_permission('configuracoes', 'view'));

-- notifications INSERT (admin pode enviar pra qualquer user)
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert to authenticated
  with check (
    auth.uid() = user_id
    or has_permission('comunicados', 'create')
  );

-- 4. Criar get_user_role_level sem parâmetro (usa auth.uid())
create or replace function public.get_user_role_level()
returns int
language plpgsql
security definer
as $$
declare
  max_level int;
begin
  select coalesce(max(r.level), 0) into max_level
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
  return max_level;
end;
$$;

-- Manter versão com param pra retrocompat (ignora param)
create or replace function public.get_user_role_level(_user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  max_level int;
begin
  select coalesce(max(r.level), 0) into max_level
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
  return max_level;
end;
$$;

-- 5. Dropar is_system_admin (não é mais usado em nenhuma policy)
drop function if exists public.is_system_admin(uuid);
