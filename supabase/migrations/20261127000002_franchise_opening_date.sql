-- Data de inauguracao da unidade (aniversario da loja)
alter table public.franchises
  add column if not exists opening_date date;
