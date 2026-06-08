-- =============================================
-- Novo fluxo de status de pedidos
-- pendente → aprovado → confirmado → separacao → faturado → entregue / cancelado
-- Integração externa dispara apenas após "aprovado"
-- =============================================

-- 1. Dropar constraint antigo primeiro
alter table public.orders drop constraint if exists orders_status_check;

-- 2. Adicionar novo constraint com todos os status (antigos + novos)
alter table public.orders add constraint orders_status_check
  check (status in ('rascunho', 'enviado', 'pendente', 'aprovado', 'confirmado', 'separacao', 'faturado', 'entregue', 'cancelado'));

-- 3. Alterar default de 'enviado' para 'pendente'
alter table public.orders alter column status set default 'pendente';

-- 4. Migrar pedidos existentes
update public.orders set status = 'pendente' where status = 'enviado';
update public.orders set status = 'pendente' where status = 'rascunho';
