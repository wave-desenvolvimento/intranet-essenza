-- App settings (key/value global)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default 'false'::jsonb,
  updated_at timestamptz not null default now()
);

-- Trigger updated_at
create or replace function update_app_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function update_app_settings_updated_at();

-- RLS
alter table app_settings enable row level security;

create policy "Authenticated can read app_settings"
  on app_settings for select to authenticated using (true);

create policy "Admin can update app_settings"
  on app_settings for update to authenticated
  using (
    exists (
      select 1 from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and p.module = 'configuracoes' and p.action = 'edit'
    )
  );

create policy "Admin can insert app_settings"
  on app_settings for insert to authenticated
  with check (
    exists (
      select 1 from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and p.module = 'configuracoes' and p.action = 'edit'
    )
  );

-- Default: folder style off
insert into app_settings (key, value) values ('folder_card_style', '"default"'::jsonb)
on conflict (key) do nothing;
