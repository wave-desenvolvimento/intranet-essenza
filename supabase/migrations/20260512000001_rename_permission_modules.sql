-- Rename permission modules: orders → pedidos, products → produtos
-- Also add missing pedidos.view_all permission

-- 1. Rename modules in permissions table
UPDATE public.permissions SET module = 'pedidos' WHERE module = 'orders';
UPDATE public.permissions SET module = 'produtos' WHERE module = 'products';

-- 2. Add view_all permission for pedidos (used by sidebar + RLS)
INSERT INTO public.permissions (module, action, description)
VALUES ('pedidos', 'view_all', 'Ver todos os pedidos')
ON CONFLICT (module, action) DO NOTHING;

-- 3. Grant view_all to roles that have pedidos.approve
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions pa ON pa.id = rp.permission_id AND pa.module = 'pedidos' AND pa.action = 'approve'
CROSS JOIN public.permissions p
WHERE p.module = 'pedidos' AND p.action = 'view_all'
ON CONFLICT DO NOTHING;

-- 4. Update RLS policies that reference old module names

-- Products
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'produtos', 'edit'));

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'produtos', 'edit'));

DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'produtos', 'delete'));

-- Product prices
DROP POLICY IF EXISTS "prices_insert" ON public.product_prices;
CREATE POLICY "prices_insert" ON public.product_prices FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'produtos', 'edit'));

DROP POLICY IF EXISTS "prices_update" ON public.product_prices;
CREATE POLICY "prices_update" ON public.product_prices FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'produtos', 'edit'));

DROP POLICY IF EXISTS "prices_delete" ON public.product_prices;
CREATE POLICY "prices_delete" ON public.product_prices FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'produtos', 'edit'));

-- Orders
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'pedidos', 'approve'));

-- Order items
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'pedidos', 'approve'));

DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'pedidos', 'approve'));

-- Product categories (may not exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    DROP POLICY IF EXISTS "product_categories_insert" ON public.product_categories;
    CREATE POLICY "product_categories_insert" ON public.product_categories FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'produtos', 'edit'));

    DROP POLICY IF EXISTS "product_categories_update" ON public.product_categories;
    CREATE POLICY "product_categories_update" ON public.product_categories FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'produtos', 'edit'));

    DROP POLICY IF EXISTS "product_categories_delete" ON public.product_categories;
    CREATE POLICY "product_categories_delete" ON public.product_categories FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'produtos', 'edit'));
  END IF;
END $$;

-- 5. Add missing SELECT policies for products and prices
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prices_select" ON public.product_prices;
CREATE POLICY "prices_select" ON public.product_prices FOR SELECT TO authenticated USING (true);

-- 6. Fix analytics_events SELECT policy (analytics → relatorios)
DROP POLICY IF EXISTS "Admins can read analytics" ON public.analytics_events;
CREATE POLICY "Admins can read analytics" ON public.analytics_events FOR SELECT
  USING (public.has_permission(auth.uid(), 'relatorios', 'view'));
