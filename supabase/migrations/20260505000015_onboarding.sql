-- Track onboarding completion
alter table public.profiles
  add column onboarding_completed boolean not null default false;
