-- Preferencias de email por categoria
-- Cada key e um booleano: true = recebe, false = nao recebe
-- Categorias: content, announcements, surveys, orders
-- "system" nao existe na coluna porque sempre envia
alter table public.profiles add column if not exists email_prefs jsonb not null default '{}';

-- Default vazio = usa defaults do app (content=false, resto=true)
comment on column public.profiles.email_prefs is 'Email notification preferences. Keys: content, announcements, surveys, orders. Missing key = use app default.';
