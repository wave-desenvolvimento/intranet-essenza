-- =============================================================
-- SEED: Dados para popular relatórios (APENAS LOCAL)
-- =============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_franchise_ids uuid[];
  v_item_ids uuid[];
  v_product_ids uuid[];
  v_order_id uuid;
  i int;
  j int;
  v_franchise uuid;
  v_item uuid;
  v_status text;
  v_total numeric;
  v_qty int;
  v_price numeric;
  v_days_ago int;
  v_prod_name text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário, abortando.';
    RETURN;
  END IF;

  SELECT array_agg(id) INTO v_franchise_ids FROM franchises;
  SELECT array_agg(id) INTO v_item_ids FROM cms_items;

  UPDATE profiles SET franchise_id = v_franchise_ids[1]
  WHERE id = v_user_id AND franchise_id IS NULL;

  -- ===== 1. ANALYTICS EVENTS (600 eventos, últimos 60 dias) =====
  FOR i IN 1..600 LOOP
    v_franchise := v_franchise_ids[1 + floor(random() * array_length(v_franchise_ids, 1))::int];
    v_item := v_item_ids[1 + floor(random() * array_length(v_item_ids, 1))::int];
    v_days_ago := floor(random() * 55)::int;

    INSERT INTO analytics_events (user_id, franchise_id, item_id, collection_id, event_type, created_at)
    SELECT v_user_id, v_franchise, v_item, ci.collection_id,
      CASE WHEN random() < 0.65 THEN 'view' ELSE 'download' END,
      now() - (v_days_ago || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    FROM cms_items ci WHERE ci.id = v_item;
  END LOOP;

  -- ===== 2. PRODUCTS (20 produtos) =====
  INSERT INTO products (name, sku, category, unit, min_qty, active) VALUES
    ('Café Essenza Gourmet 250g',       'CAF-250G', 'Cafés',       'un', 6, true),
    ('Café Essenza Premium 500g',       'CAF-500G', 'Cafés',       'un', 3, true),
    ('Café Essenza Descafeinado 250g',  'CAF-DESC', 'Cafés',       'un', 6, true),
    ('Café Essenza Espresso 1kg',       'CAF-1KG',  'Cafés',       'un', 2, true),
    ('Drip Coffee Essenza cx12',        'DRP-12',   'Cafés',       'cx', 4, true),
    ('Cápsula Essenza cx10',            'CAP-10',   'Cafés',       'cx', 6, true),
    ('Chá Camomila cx20',               'CHA-CAM',  'Chás',        'cx', 4, true),
    ('Chá Verde Essenza cx20',          'CHA-VER',  'Chás',        'cx', 4, true),
    ('Chá Hibisco cx20',                'CHA-HIB',  'Chás',        'cx', 4, true),
    ('Infusor Inox Essenza',            'INF-INX',  'Acessórios',  'un', 2, true),
    ('Caneca Essenza 350ml',            'CAN-350',  'Acessórios',  'un', 6, true),
    ('Prensa Francesa 600ml',           'PRE-600',  'Acessórios',  'un', 2, true),
    ('Moedor Manual Essenza',           'MOE-MAN',  'Acessórios',  'un', 1, true),
    ('Kit Degustação Cafés',            'KIT-DEG',  'Kits',        'un', 2, true),
    ('Kit Presente Essenza',            'KIT-PRE',  'Kits',        'un', 1, true),
    ('Kit Escritório Café',             'KIT-ESC',  'Kits',        'un', 1, true),
    ('Açúcar Demerara Essenza 500g',    'ACU-DEM',  'Complementos','un', 6, true),
    ('Mel Essenza 300g',                'MEL-300',  'Complementos','un', 4, true),
    ('Biscoito Amanteigado cx',         'BIS-AMT',  'Complementos','cx', 6, true),
    ('Chocolate 70% Essenza 80g',       'CHO-70',   'Complementos','un', 12, true)
  ON CONFLICT (sku) DO NOTHING;

  SELECT array_agg(id) INTO v_product_ids FROM products WHERE active = true;

  -- Preços por segmento
  FOR i IN 1..array_length(v_product_ids, 1) LOOP
    INSERT INTO product_prices (product_id, segment, price) VALUES
      (v_product_ids[i], 'franquia',       (15.00 + (random() * 180))::numeric(10,2)),
      (v_product_ids[i], 'multimarca_pdv', (18.00 + (random() * 200))::numeric(10,2))
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ===== 3. ORDERS (40 pedidos, últimos 60 dias) =====
  FOR i IN 1..40 LOOP
    v_franchise := v_franchise_ids[1 + floor(random() * array_length(v_franchise_ids, 1))::int];
    v_days_ago := floor(random() * 55)::int;

    v_status := CASE
      WHEN random() < 0.30 THEN 'enviado'
      WHEN random() < 0.55 THEN 'confirmado'
      WHEN random() < 0.85 THEN 'faturado'
      WHEN random() < 0.95 THEN 'rascunho'
      ELSE 'cancelado'
    END;

    v_total := 0;

    INSERT INTO orders (franchise_id, created_by, status, total, notes, created_at)
    VALUES (
      v_franchise, v_user_id, v_status, 0,
      CASE WHEN random() < 0.3 THEN 'Pedido urgente' WHEN random() < 0.5 THEN 'Reposição mensal' ELSE null END,
      now() - (v_days_ago || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    )
    RETURNING id INTO v_order_id;

    -- 2–6 itens por pedido
    FOR j IN 1..(2 + floor(random() * 5)::int) LOOP
      DECLARE
        v_prod_id uuid;
      BEGIN
        v_prod_id := v_product_ids[1 + floor(random() * array_length(v_product_ids, 1))::int];
        v_qty := 1 + floor(random() * 20)::int;
        v_price := (15.00 + (random() * 180))::numeric(10,2);

        SELECT name INTO v_prod_name FROM products WHERE id = v_prod_id;

        INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (v_order_id, v_prod_id, v_prod_name, v_qty, v_price, (v_qty * v_price)::numeric(10,2));

        v_total := v_total + (v_qty * v_price);
      END;
    END LOOP;

    UPDATE orders SET total = v_total::numeric(10,2) WHERE id = v_order_id;
  END LOOP;

  RAISE NOTICE 'Seed relatórios completo: 600 analytics, 20 produtos, 40 pedidos';
END $$;
