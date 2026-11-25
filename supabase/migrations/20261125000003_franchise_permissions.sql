-- Permissoes dos perfis conforme reuniao (task 30899)

-- Copia para rollback
create table public.role_permissions_bkp_20261125 as select * from public.role_permissions;
alter table public.role_permissions_bkp_20261125 enable row level security;

-- Pedidos/Comercial: so Owner
delete from public.role_permissions rp using public.roles r, public.permissions p
where r.id = rp.role_id and p.id = rp.permission_id
  and r.slug <> 'owner' and p.module in ('pedidos', 'produtos', 'leads');

-- Perfis de franquia: fora da area administrativa e conteudo somente leitura
delete from public.role_permissions rp using public.roles r, public.permissions p
where r.id = rp.role_id and p.id = rp.permission_id and not r.is_system
  and (
    p.module in ('franquias', 'relatorios', 'historico', 'configuracoes', 'cms')
    or (p.module = 'usuarios' and (r.slug <> 'admin_franquia' or p.action = 'manage'))
    or (p.module not in ('usuarios') and p.action not in ('view', 'download')
        and not (p.module = 'suporte' and p.action = 'create'))
  );

insert into public.permissions (module, action, description)
select m, a, m || '.' || a from (values
  ('comunicados', 'view'), ('pesquisas', 'view'), ('suporte', 'view'), ('suporte', 'create'),
  ('usuarios', 'view'), ('usuarios', 'create'), ('usuarios', 'edit'), ('usuarios', 'delete')
) x(m, a)
where not exists (select 1 from public.permissions p where p.module = m and p.action = a);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where (r.slug in ('admin_franquia', 'usuario_franquia')
    and (p.module, p.action) in (('comunicados', 'view'), ('pesquisas', 'view'), ('suporte', 'view'), ('suporte', 'create')))
  or (r.slug = 'admin_franquia' and p.module = 'usuarios' and p.action in ('view', 'create', 'edit', 'delete'))
on conflict do nothing;
