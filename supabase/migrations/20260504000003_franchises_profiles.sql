-- Franquias
create table public.franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger franchises_updated_at
  before update on public.franchises
  for each row execute function public.set_updated_at();

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  franchise_id uuid references public.franchises(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_franchise_admin boolean not null default false,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Indexes
create index idx_profiles_franchise on public.profiles(franchise_id);
create index idx_profiles_status on public.profiles(status);

-- RLS
alter table public.franchises enable row level security;
alter table public.profiles enable row level security;

-- Franchises: authenticated can read
create policy "franchises_select" on public.franchises for select to authenticated using (true);
create policy "franchises_insert" on public.franchises for insert to authenticated with check (true);
create policy "franchises_update" on public.franchises for update to authenticated using (true);
create policy "franchises_delete" on public.franchises for delete to authenticated using (true);

-- Profiles: authenticated can read all, write policies via permission check
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (true);
create policy "profiles_update" on public.profiles for update to authenticated using (true);
create policy "profiles_delete" on public.profiles for delete to authenticated using (true);

-- Auto-create profile on user signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update last_sign_in_at on login
create or replace function public.handle_user_sign_in()
returns trigger as $$
begin
  update public.profiles
  set last_sign_in_at = now()
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_sign_in();
