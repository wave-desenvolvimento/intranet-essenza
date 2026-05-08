-- RPC: checa se o user tem uma permissão específica via seus roles
create or replace function public.has_permission(
  _user_id uuid,
  _module text,
  _action text
)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = _user_id
      and p.module = _module
      and p.action = _action
  );
$$;

-- RPC: retorna todas as permissões do user (module.action)
create or replace function public.get_user_permissions(_user_id uuid)
returns table (module text, action text)
language sql
stable
security definer
as $$
  select distinct p.module, p.action
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = _user_id;
$$;
