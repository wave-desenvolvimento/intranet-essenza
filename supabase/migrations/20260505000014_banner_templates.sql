-- Dedicated banner templates module
create table public.banner_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  background_image text,
  background_color_start text,
  background_color_end text,
  aspect_ratio text not null default '16/6',
  overlays jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger banner_templates_updated_at
  before update on public.banner_templates
  for each row execute function public.set_updated_at();

-- RLS
alter table public.banner_templates enable row level security;

create policy "Authenticated can read published templates"
  on public.banner_templates for select
  to authenticated
  using (true);

create policy "Authenticated can manage templates"
  on public.banner_templates for all
  to authenticated
  using (true)
  with check (true);
