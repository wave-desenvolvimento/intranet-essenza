-- Tipo de ponto de venda da franquia
alter table public.franchises
  add column store_type text not null default 'loja'
  check (store_type in ('loja', 'quiosque'));
