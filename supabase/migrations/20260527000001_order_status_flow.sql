-- =============================================
-- Novo fluxo de status de pedidos
-- pendente → aprovado → confirmado → separacao → faturado → entregue / cancelado
-- Integração externa dispara apenas após "aprovado"
-- =============================================

-- 1. Alterar default de 'enviado' para 'pendente'
alter table public.orders alter column status set default 'pendente';

-- 2. Migrar pedidos existentes com status 'enviado' para 'pendente'
update public.orders set status = 'pendente' where status = 'enviado';

-- 3. Migrar pedidos com status 'rascunho' para 'pendente'
update public.orders set status = 'pendente' where status = 'rascunho';

-- 4. Alterar constraint de check para novos status
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendente', 'aprovado', 'confirmado', 'separacao', 'faturado', 'entregue', 'cancelado'));
