-- Simplificar status de pedidos: apenas pendente e aprovado
-- Migrar pedidos com status antigos

-- 1. Migrar pedidos existentes com status intermediários para "aprovado"
update public.orders set status = 'aprovado' where status in ('confirmado', 'separacao', 'faturado', 'entregue');

-- 2. Migrar pedidos cancelados para "pendente" (ou delete se preferir)
-- Mantendo cancelados como pendente para não perder dados
update public.orders set status = 'pendente' where status in ('rascunho', 'enviado', 'cancelado');

-- 3. Atualizar constraint
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendente', 'aprovado'));
