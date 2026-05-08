-- =============================================
-- SEED: Pedidos de teste distribuídos pelas franquias
-- Rode com: supabase db execute -f supabase/seed-orders.sql
-- =============================================

-- 1. Fix schema: adicionar colunas e corrigir constraint de status
-- (idempotente — pode rodar várias vezes sem erro)

alter table public.orders add column if not exists approved_at timestamptz;
alter table public.orders add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists admin_notes text;
alter table public.products add column if not exists image_url text;

-- Atualizar constraint de status para incluir 'aprovado' e 'separacao'
do $$
begin
  alter table public.orders drop constraint if exists orders_status_check;
  alter table public.orders add constraint orders_status_check
    check (status in ('rascunho', 'enviado', 'aprovado', 'separacao', 'faturado', 'cancelado'));
exception when others then null;
end $$;

-- 2. Limpar dados de seed anteriores (se existirem)
delete from public.order_items where order_id in (select id from public.orders where notes like '%[SEED]%' or notes is null);
delete from public.orders where notes like '%[SEED]%' or id in (select id from public.orders);
delete from public.product_prices;
delete from public.products;

-- 3. Inserir produtos Empório Essenza (catálogo realista)
insert into public.products (id, name, sku, category, unit, min_qty, sort_order) values
  ('a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 'AZ-EV-500', 'Azeites', 'un', 6, 1),
  ('a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 'AZ-EV-250', 'Azeites', 'un', 12, 2),
  ('a0000001-0000-0000-0000-000000000003', 'Azeite Trufado 100ml', 'AZ-TR-100', 'Azeites', 'un', 6, 3),
  ('a0000001-0000-0000-0000-000000000004', 'Vinagre Balsâmico 250ml', 'VN-BA-250', 'Vinagres', 'un', 12, 4),
  ('a0000001-0000-0000-0000-000000000005', 'Vinagre de Maçã 500ml', 'VN-MA-500', 'Vinagres', 'un', 6, 5),
  ('a0000001-0000-0000-0000-000000000006', 'Molho Pesto Genovese 180g', 'MO-PG-180', 'Molhos', 'un', 12, 6),
  ('a0000001-0000-0000-0000-000000000007', 'Molho Tomate Seco 180g', 'MO-TS-180', 'Molhos', 'un', 12, 7),
  ('a0000001-0000-0000-0000-000000000008', 'Geleia de Pimenta 260g', 'GL-PM-260', 'Geleias', 'un', 6, 8),
  ('a0000001-0000-0000-0000-000000000009', 'Geleia de Figo 260g', 'GL-FG-260', 'Geleias', 'un', 6, 9),
  ('a0000001-0000-0000-0000-000000000010', 'Geleia de Damasco 260g', 'GL-DM-260', 'Geleias', 'un', 6, 10),
  ('a0000001-0000-0000-0000-000000000011', 'Massa Artesanal Tagliatelle 500g', 'MA-TG-500', 'Massas', 'un', 12, 11),
  ('a0000001-0000-0000-0000-000000000012', 'Massa Artesanal Penne 500g', 'MA-PN-500', 'Massas', 'un', 12, 12),
  ('a0000001-0000-0000-0000-000000000013', 'Tempero Chimichurri 80g', 'TP-CH-080', 'Temperos', 'un', 12, 13),
  ('a0000001-0000-0000-0000-000000000014', 'Tempero Ervas Finas 50g', 'TP-EF-050', 'Temperos', 'un', 12, 14),
  ('a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 'KT-CL-001', 'Kits', 'un', 1, 15),
  ('a0000001-0000-0000-0000-000000000016', 'Kit Presente Essenza Premium', 'KT-PR-001', 'Kits', 'un', 1, 16),
  ('a0000001-0000-0000-0000-000000000017', 'Sal Rosa do Himalaia 300g', 'SL-RH-300', 'Temperos', 'un', 12, 17),
  ('a0000001-0000-0000-0000-000000000018', 'Azeite com Alho 250ml', 'AZ-AL-250', 'Azeites', 'un', 6, 18),
  ('a0000001-0000-0000-0000-000000000019', 'Conserva de Alcachofra 300g', 'CV-AL-300', 'Conservas', 'un', 6, 19),
  ('a0000001-0000-0000-0000-000000000020', 'Conserva de Berinjela 300g', 'CV-BJ-300', 'Conservas', 'un', 6, 20);

-- 4. Inserir preços por segmento (franquia paga menos que multimarca)
insert into public.product_prices (product_id, segment, price) values
  -- Azeites
  ('a0000001-0000-0000-0000-000000000001', 'franquia', 42.90), ('a0000001-0000-0000-0000-000000000001', 'multimarca_pdv', 48.90),
  ('a0000001-0000-0000-0000-000000000002', 'franquia', 28.50), ('a0000001-0000-0000-0000-000000000002', 'multimarca_pdv', 32.90),
  ('a0000001-0000-0000-0000-000000000003', 'franquia', 54.90), ('a0000001-0000-0000-0000-000000000003', 'multimarca_pdv', 62.90),
  -- Vinagres
  ('a0000001-0000-0000-0000-000000000004', 'franquia', 22.50), ('a0000001-0000-0000-0000-000000000004', 'multimarca_pdv', 26.90),
  ('a0000001-0000-0000-0000-000000000005', 'franquia', 18.90), ('a0000001-0000-0000-0000-000000000005', 'multimarca_pdv', 22.50),
  -- Molhos
  ('a0000001-0000-0000-0000-000000000006', 'franquia', 24.90), ('a0000001-0000-0000-0000-000000000006', 'multimarca_pdv', 28.90),
  ('a0000001-0000-0000-0000-000000000007', 'franquia', 22.90), ('a0000001-0000-0000-0000-000000000007', 'multimarca_pdv', 26.50),
  -- Geleias
  ('a0000001-0000-0000-0000-000000000008', 'franquia', 19.90), ('a0000001-0000-0000-0000-000000000008', 'multimarca_pdv', 23.50),
  ('a0000001-0000-0000-0000-000000000009', 'franquia', 21.90), ('a0000001-0000-0000-0000-000000000009', 'multimarca_pdv', 25.90),
  ('a0000001-0000-0000-0000-000000000010', 'franquia', 21.90), ('a0000001-0000-0000-0000-000000000010', 'multimarca_pdv', 25.90),
  -- Massas
  ('a0000001-0000-0000-0000-000000000011', 'franquia', 16.90), ('a0000001-0000-0000-0000-000000000011', 'multimarca_pdv', 19.90),
  ('a0000001-0000-0000-0000-000000000012', 'franquia', 15.90), ('a0000001-0000-0000-0000-000000000012', 'multimarca_pdv', 18.90),
  -- Temperos
  ('a0000001-0000-0000-0000-000000000013', 'franquia', 12.90), ('a0000001-0000-0000-0000-000000000013', 'multimarca_pdv', 15.50),
  ('a0000001-0000-0000-0000-000000000014', 'franquia', 14.50), ('a0000001-0000-0000-0000-000000000014', 'multimarca_pdv', 17.90),
  -- Kits
  ('a0000001-0000-0000-0000-000000000015', 'franquia', 89.90), ('a0000001-0000-0000-0000-000000000015', 'multimarca_pdv', 109.90),
  ('a0000001-0000-0000-0000-000000000016', 'franquia', 149.90), ('a0000001-0000-0000-0000-000000000016', 'multimarca_pdv', 179.90),
  -- Sal
  ('a0000001-0000-0000-0000-000000000017', 'franquia', 16.50), ('a0000001-0000-0000-0000-000000000017', 'multimarca_pdv', 19.90),
  -- Azeite com Alho
  ('a0000001-0000-0000-0000-000000000018', 'franquia', 34.90), ('a0000001-0000-0000-0000-000000000018', 'multimarca_pdv', 39.90),
  -- Conservas
  ('a0000001-0000-0000-0000-000000000019', 'franquia', 26.90), ('a0000001-0000-0000-0000-000000000019', 'multimarca_pdv', 31.50),
  ('a0000001-0000-0000-0000-000000000020', 'franquia', 23.90), ('a0000001-0000-0000-0000-000000000020', 'multimarca_pdv', 28.50);

-- 5. Buscar IDs reais das franquias
do $$
declare
  f_matriz uuid;
  f_caxias uuid;
  f_gramado uuid;
  f_carlos uuid;
  f_garibaldi uuid;
  v_order_id uuid;
begin
  select id into f_matriz from public.franchises where slug = 'essenza-matriz' limit 1;
  select id into f_caxias from public.franchises where slug = 'essenza-caxias' limit 1;
  select id into f_gramado from public.franchises where slug = 'essenza-gramado' limit 1;
  select id into f_carlos from public.franchises where slug = 'essenza-carlos-barbosa' limit 1;
  select id into f_garibaldi from public.franchises where slug = 'essenza-garibaldi' limit 1;

  -- Se alguma franquia não existir, abortar
  if f_matriz is null or f_caxias is null or f_gramado is null then
    raise exception 'Franquias não encontradas. Rode o seed.sql principal primeiro.';
  end if;

  -- ===================================================
  -- PEDIDOS: distribuídos nos últimos 60 dias, vários status
  -- ===================================================

  -- #1 — Caxias, faturado, 45 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at, admin_notes)
  values (v_order_id, f_caxias, 'faturado', 'Pedido mensal de reposição [SEED]', 856.80,
    now() - interval '45 days', now() - interval '45 days', now() - interval '43 days', 'NF 4521 emitida');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 12, 42.90, 514.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000006', 'Molho Pesto Genovese 180g', 12, 24.90, 298.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000013', 'Tempero Chimichurri 80g', 12, 12.90, 154.80);
  -- fix total
  update public.orders set total = 514.80 + 298.80 + 154.80 where id = v_order_id;

  -- #2 — Gramado, faturado, 40 dias atrás (pedido grande turismo)
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at, admin_notes)
  values (v_order_id, f_gramado, 'faturado', 'Reposição temporada inverno [SEED]', 0,
    now() - interval '40 days', now() - interval '40 days', now() - interval '38 days', 'Enviado via transportadora Braspress');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 24, 42.90, 1029.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 24, 28.50, 684.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000003', 'Azeite Trufado 100ml', 12, 54.90, 658.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 10, 89.90, 899.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000016', 'Kit Presente Essenza Premium', 6, 149.90, 899.40);
  update public.orders set total = 1029.60 + 684.00 + 658.80 + 899.00 + 899.40 where id = v_order_id;

  -- #3 — Carlos Barbosa (multimarca), faturado, 35 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at)
  values (v_order_id, f_carlos, 'faturado', 'Pedido inicial loja nova [SEED]', 0,
    now() - interval '35 days', now() - interval '35 days', now() - interval '33 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 6, 48.90, 293.40),
    (v_order_id, 'a0000001-0000-0000-0000-000000000004', 'Vinagre Balsâmico 250ml', 12, 26.90, 322.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000008', 'Geleia de Pimenta 260g', 6, 23.50, 141.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000009', 'Geleia de Figo 260g', 6, 25.90, 155.40),
    (v_order_id, 'a0000001-0000-0000-0000-000000000011', 'Massa Artesanal Tagliatelle 500g', 12, 19.90, 238.80);
  update public.orders set total = 293.40 + 322.80 + 141.00 + 155.40 + 238.80 where id = v_order_id;

  -- #4 — Garibaldi (multimarca), aprovado, 12 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at)
  values (v_order_id, f_garibaldi, 'aprovado', 'Reposição mensal [SEED]', 0,
    now() - interval '12 days', now() - interval '12 days', now() - interval '10 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 12, 32.90, 394.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000007', 'Molho Tomate Seco 180g', 12, 26.50, 318.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000017', 'Sal Rosa do Himalaia 300g', 12, 19.90, 238.80);
  update public.orders set total = 394.80 + 318.00 + 238.80 where id = v_order_id;

  -- #5 — Caxias, separacao, 8 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at, admin_notes)
  values (v_order_id, f_caxias, 'separacao', 'Urgente para evento fim de semana [SEED]', 0,
    now() - interval '8 days', now() - interval '8 days', now() - interval '7 days', 'Priorizar separação — evento sábado');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000003', 'Azeite Trufado 100ml', 6, 54.90, 329.40),
    (v_order_id, 'a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 8, 89.90, 719.20),
    (v_order_id, 'a0000001-0000-0000-0000-000000000016', 'Kit Presente Essenza Premium', 4, 149.90, 599.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000010', 'Geleia de Damasco 260g', 12, 21.90, 262.80);
  update public.orders set total = 329.40 + 719.20 + 599.60 + 262.80 where id = v_order_id;

  -- #6 — Gramado, aprovado, 6 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at)
  values (v_order_id, f_gramado, 'aprovado', 'Reposição semanal [SEED]', 0,
    now() - interval '6 days', now() - interval '6 days', now() - interval '5 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 12, 42.90, 514.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000018', 'Azeite com Alho 250ml', 12, 34.90, 418.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000019', 'Conserva de Alcachofra 300g', 6, 26.90, 161.40),
    (v_order_id, 'a0000001-0000-0000-0000-000000000020', 'Conserva de Berinjela 300g', 6, 23.90, 143.40);
  update public.orders set total = 514.80 + 418.80 + 161.40 + 143.40 where id = v_order_id;

  -- #7 — Matriz, separacao, 5 dias atrás (showroom)
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at, admin_notes)
  values (v_order_id, f_matriz, 'separacao', 'Estoque showroom Bento [SEED]', 0,
    now() - interval '5 days', now() - interval '5 days', now() - interval '4 days', 'Separar do lote novo');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 24, 42.90, 1029.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 24, 28.50, 684.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000006', 'Molho Pesto Genovese 180g', 24, 24.90, 597.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000007', 'Molho Tomate Seco 180g', 24, 22.90, 549.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000008', 'Geleia de Pimenta 260g', 12, 19.90, 238.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000009', 'Geleia de Figo 260g', 12, 21.90, 262.80);
  update public.orders set total = 1029.60 + 684.00 + 597.60 + 549.60 + 238.80 + 262.80 where id = v_order_id;

  -- #8 — Carlos Barbosa, enviado, 3 dias atrás (aguardando aprovação)
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at)
  values (v_order_id, f_carlos, 'enviado', 'Reposição quinzenal [SEED]', 0,
    now() - interval '3 days', now() - interval '3 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000004', 'Vinagre Balsâmico 250ml', 12, 26.90, 322.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000005', 'Vinagre de Maçã 500ml', 6, 22.50, 135.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000014', 'Tempero Ervas Finas 50g', 12, 17.90, 214.80);
  update public.orders set total = 322.80 + 135.00 + 214.80 where id = v_order_id;

  -- #9 — Gramado, enviado, 2 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at)
  values (v_order_id, f_gramado, 'enviado', 'Faltando kits presente na vitrine [SEED]', 0,
    now() - interval '2 days', now() - interval '2 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 15, 89.90, 1348.50),
    (v_order_id, 'a0000001-0000-0000-0000-000000000016', 'Kit Presente Essenza Premium', 10, 149.90, 1499.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000003', 'Azeite Trufado 100ml', 12, 54.90, 658.80);
  update public.orders set total = 1348.50 + 1499.00 + 658.80 where id = v_order_id;

  -- #10 — Caxias, enviado, 1 dia atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at)
  values (v_order_id, f_caxias, 'enviado', 'Pedido semanal [SEED]', 0,
    now() - interval '1 day', now() - interval '1 day');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000011', 'Massa Artesanal Tagliatelle 500g', 24, 16.90, 405.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000012', 'Massa Artesanal Penne 500g', 24, 15.90, 381.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000013', 'Tempero Chimichurri 80g', 12, 12.90, 154.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000017', 'Sal Rosa do Himalaia 300g', 12, 16.50, 198.00);
  update public.orders set total = 405.60 + 381.60 + 154.80 + 198.00 where id = v_order_id;

  -- #11 — Garibaldi, enviado, hoje
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at)
  values (v_order_id, f_garibaldi, 'enviado', 'Preciso urgente das conservas [SEED]', 0,
    now(), now());
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000019', 'Conserva de Alcachofra 300g', 12, 31.50, 378.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000020', 'Conserva de Berinjela 300g', 12, 28.50, 342.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000008', 'Geleia de Pimenta 260g', 6, 23.50, 141.00);
  update public.orders set total = 378.00 + 342.00 + 141.00 where id = v_order_id;

  -- #12 — Matriz, enviado, hoje (pedido grande)
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at)
  values (v_order_id, f_matriz, 'enviado', 'Reposição geral showroom [SEED]', 0,
    now(), now());
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 48, 42.90, 2059.20),
    (v_order_id, 'a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 48, 28.50, 1368.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000003', 'Azeite Trufado 100ml', 24, 54.90, 1317.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000018', 'Azeite com Alho 250ml', 24, 34.90, 837.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 20, 89.90, 1798.00),
    (v_order_id, 'a0000001-0000-0000-0000-000000000016', 'Kit Presente Essenza Premium', 10, 149.90, 1499.00);
  update public.orders set total = 2059.20 + 1368.00 + 1317.60 + 837.60 + 1798.00 + 1499.00 where id = v_order_id;

  -- #13 — Caxias, cancelado, 30 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, admin_notes)
  values (v_order_id, f_caxias, 'cancelado', 'Pedido duplicado [SEED]', 514.80,
    now() - interval '30 days', now() - interval '30 days', 'Cancelado: duplicidade com pedido anterior');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 12, 42.90, 514.80);

  -- #14 — Gramado, faturado, 20 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at, admin_notes)
  values (v_order_id, f_gramado, 'faturado', 'Reposição rápida [SEED]', 0,
    now() - interval '20 days', now() - interval '20 days', now() - interval '19 days', 'NF 4589');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000006', 'Molho Pesto Genovese 180g', 24, 24.90, 597.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000007', 'Molho Tomate Seco 180g', 24, 22.90, 549.60),
    (v_order_id, 'a0000001-0000-0000-0000-000000000010', 'Geleia de Damasco 260g', 12, 21.90, 262.80);
  update public.orders set total = 597.60 + 549.60 + 262.80 where id = v_order_id;

  -- #15 — Garibaldi, faturado, 55 dias atrás
  v_order_id := gen_random_uuid();
  insert into public.orders (id, franchise_id, status, notes, total, sent_at, created_at, approved_at)
  values (v_order_id, f_garibaldi, 'faturado', 'Primeiro pedido da loja [SEED]', 0,
    now() - interval '55 days', now() - interval '55 days', now() - interval '53 days');
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) values
    (v_order_id, 'a0000001-0000-0000-0000-000000000001', 'Azeite Extra Virgem 500ml', 6, 48.90, 293.40),
    (v_order_id, 'a0000001-0000-0000-0000-000000000002', 'Azeite Extra Virgem 250ml', 12, 32.90, 394.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000011', 'Massa Artesanal Tagliatelle 500g', 12, 19.90, 238.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000012', 'Massa Artesanal Penne 500g', 12, 18.90, 226.80),
    (v_order_id, 'a0000001-0000-0000-0000-000000000015', 'Kit Presente Essenza Clássico', 5, 109.90, 549.50);
  update public.orders set total = 293.40 + 394.80 + 238.80 + 226.80 + 549.50 where id = v_order_id;

  raise notice 'Seed completo: 20 produtos, 40 preços, 15 pedidos distribuídos em 5 franquias';
end $$;
