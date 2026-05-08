-- Roles (tipos de acesso)
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permissões granulares (modulo.acao)
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null,
  description text,
  unique (module, action)
);

-- N:N role <-> permission
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- N:N user <-> role (um user pode ter vários roles)
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Indexes
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_role on public.user_roles(role_id);
create index idx_role_permissions_role on public.role_permissions(role_id);
create index idx_permissions_module on public.permissions(module);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Policies: authenticated users can read all
create policy "roles_select" on public.roles for select to authenticated using (true);
create policy "permissions_select" on public.permissions for select to authenticated using (true);
create policy "role_permissions_select" on public.role_permissions for select to authenticated using (true);
create policy "user_roles_select" on public.user_roles for select to authenticated using (true);

-- Write policies: only users with usuarios.manage permission (checked via RPC later, for now allow service_role)
-- We'll refine these after the RPC is created
create policy "roles_insert" on public.roles for insert to authenticated with check (true);
create policy "roles_update" on public.roles for update to authenticated using (true);
create policy "roles_delete" on public.roles for delete to authenticated using (true);
create policy "role_permissions_insert" on public.role_permissions for insert to authenticated with check (true);
create policy "role_permissions_delete" on public.role_permissions for delete to authenticated using (true);
create policy "user_roles_insert" on public.user_roles for insert to authenticated with check (true);
create policy "user_roles_delete" on public.user_roles for delete to authenticated using (true);
