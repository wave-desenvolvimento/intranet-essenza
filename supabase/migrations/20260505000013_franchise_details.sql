-- Enrich franchise data for banner template variables
alter table public.franchises
  add column phone text,
  add column whatsapp text,
  add column email text,
  add column instagram text,
  add column facebook text,
  add column tiktok text,
  add column website text,
  add column logo_url text,
  add column address text,
  add column neighborhood text,
  add column state text,
  add column cep text,
  add column cnpj text,
  add column opening_hours text,
  add column manager_name text;
