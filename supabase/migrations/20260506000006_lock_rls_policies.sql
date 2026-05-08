-- =============================================
-- SECURITY FIX: Lock down all open write RLS policies
-- Replace "using (true)" with proper permission checks
-- =============================================

-- =============================================
-- 1. ROLES / PERMISSIONS / USER_ROLES
-- Only system admins (level >= 80) can manage
-- =============================================

DROP POLICY IF EXISTS "roles_insert" ON public.roles;
CREATE POLICY "roles_insert" ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "roles_update" ON public.roles;
CREATE POLICY "roles_update" ON public.roles FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "roles_delete" ON public.roles;
CREATE POLICY "roles_delete" ON public.roles FOR DELETE TO authenticated
  USING (public.is_system_admin(auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
CREATE POLICY "role_permissions_insert" ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;
CREATE POLICY "role_permissions_delete" ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- user_roles: can only assign roles with level <= your own level
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'usuarios', 'manage')
    AND public.get_user_role_level(auth.uid()) >= (SELECT level FROM public.roles WHERE id = role_id)
  );

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'usuarios', 'manage')
    AND public.get_user_role_level(auth.uid()) >= (SELECT level FROM public.roles WHERE id = role_id)
  );

-- =============================================
-- 2. FRANCHISES
-- =============================================

DROP POLICY IF EXISTS "franchises_insert" ON public.franchises;
CREATE POLICY "franchises_insert" ON public.franchises FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'franquias', 'create'));

DROP POLICY IF EXISTS "franchises_update" ON public.franchises;
CREATE POLICY "franchises_update" ON public.franchises FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'franquias', 'edit'));

DROP POLICY IF EXISTS "franchises_delete" ON public.franchises;
CREATE POLICY "franchises_delete" ON public.franchises FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'franquias', 'delete'));

-- =============================================
-- 3. PROFILES
-- Users can update own profile. Admins can manage all.
-- Insert is handled by trigger (handle_new_user), keep open for that.
-- =============================================

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (true); -- trigger-only, SECURITY DEFINER

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.has_permission(auth.uid(), 'usuarios', 'edit')
  );

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'usuarios', 'delete'));

-- =============================================
-- 4. CMS (collections, fields, items)
-- =============================================

DROP POLICY IF EXISTS "cms_collections_insert" ON public.cms_collections;
CREATE POLICY "cms_collections_insert" ON public.cms_collections FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cms', 'create'));

DROP POLICY IF EXISTS "cms_collections_update" ON public.cms_collections;
CREATE POLICY "cms_collections_update" ON public.cms_collections FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'edit'));

DROP POLICY IF EXISTS "cms_collections_delete" ON public.cms_collections;
CREATE POLICY "cms_collections_delete" ON public.cms_collections FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'delete'));

DROP POLICY IF EXISTS "cms_fields_insert" ON public.cms_fields;
CREATE POLICY "cms_fields_insert" ON public.cms_fields FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cms', 'create'));

DROP POLICY IF EXISTS "cms_fields_update" ON public.cms_fields;
CREATE POLICY "cms_fields_update" ON public.cms_fields FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'edit'));

DROP POLICY IF EXISTS "cms_fields_delete" ON public.cms_fields;
CREATE POLICY "cms_fields_delete" ON public.cms_fields FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'delete'));

DROP POLICY IF EXISTS "cms_items_insert" ON public.cms_items;
CREATE POLICY "cms_items_insert" ON public.cms_items FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cms', 'create'));

DROP POLICY IF EXISTS "cms_items_update" ON public.cms_items;
CREATE POLICY "cms_items_update" ON public.cms_items FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'edit'));

DROP POLICY IF EXISTS "cms_items_delete" ON public.cms_items;
CREATE POLICY "cms_items_delete" ON public.cms_items FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'delete'));

-- =============================================
-- 5. CMS PAGES
-- =============================================

DROP POLICY IF EXISTS "pages_insert" ON public.cms_pages;
CREATE POLICY "pages_insert" ON public.cms_pages FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cms', 'create'));

DROP POLICY IF EXISTS "pages_update" ON public.cms_pages;
CREATE POLICY "pages_update" ON public.cms_pages FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'edit'));

DROP POLICY IF EXISTS "pages_delete" ON public.cms_pages;
CREATE POLICY "pages_delete" ON public.cms_pages FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'delete'));

DROP POLICY IF EXISTS "page_collections_insert" ON public.cms_page_collections;
CREATE POLICY "page_collections_insert" ON public.cms_page_collections FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cms', 'create'));

DROP POLICY IF EXISTS "page_collections_update" ON public.cms_page_collections;
CREATE POLICY "page_collections_update" ON public.cms_page_collections FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'edit'));

DROP POLICY IF EXISTS "page_collections_delete" ON public.cms_page_collections;
CREATE POLICY "page_collections_delete" ON public.cms_page_collections FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cms', 'delete'));

-- =============================================
-- 6. BANNER TEMPLATES
-- =============================================

DROP POLICY IF EXISTS "Authenticated can manage templates" ON public.banner_templates;

CREATE POLICY "templates_select" ON public.banner_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "templates_insert" ON public.banner_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'templates', 'create'));

CREATE POLICY "templates_update" ON public.banner_templates FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'templates', 'edit'));

CREATE POLICY "templates_delete" ON public.banner_templates FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'templates', 'delete'));

-- =============================================
-- 7. PRODUCTS / PRODUCT_PRICES
-- =============================================

DROP POLICY IF EXISTS "products_manage" ON public.products;
DROP POLICY IF EXISTS "products_select" ON public.products;

CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'delete'));

DROP POLICY IF EXISTS "prices_manage" ON public.product_prices;
DROP POLICY IF EXISTS "prices_select" ON public.product_prices;

CREATE POLICY "prices_insert" ON public.product_prices FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "prices_update" ON public.product_prices FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'edit'));

CREATE POLICY "prices_delete" ON public.product_prices FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'edit'));

-- =============================================
-- 8. ORDERS / ORDER_ITEMS
-- =============================================

DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'orders', 'approve')
  );

DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    -- Can insert items for orders belonging to your franchise
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.profiles p ON p.franchise_id = o.franchise_id
      WHERE o.id = order_id AND p.id = auth.uid()
    )
  );

-- Also lock down order_items update/delete
DROP POLICY IF EXISTS "order_items_manage" ON public.order_items;
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders', 'approve'));

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders', 'approve'));

-- =============================================
-- 9. SHARE LINKS — only owner can create
-- =============================================

DROP POLICY IF EXISTS "share_links_insert" ON public.share_links;
CREATE POLICY "share_links_insert" ON public.share_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- =============================================
-- 10. NOTIFICATIONS — restrict insert to server (service_role) + triggers
-- =============================================

DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
-- Notifications are inserted by SECURITY DEFINER triggers and server actions
-- Server actions use the anon key with RLS, so we need authenticated insert
-- but restrict to inserting for yourself or via has_permission
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_system_admin(auth.uid())
  );

-- =============================================
-- 11. PRODUCT CATEGORIES
-- Table may not exist yet (created via Studio), so wrap in DO block
-- =============================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "product_categories_manage" ON public.product_categories;
    CREATE POLICY "product_categories_select" ON public.product_categories FOR SELECT TO authenticated USING (true);
    CREATE POLICY "product_categories_insert" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'products', 'edit'));
    CREATE POLICY "product_categories_update" ON public.product_categories FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'products', 'edit'));
    CREATE POLICY "product_categories_delete" ON public.product_categories FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'products', 'edit'));
  END IF;
END $$;

-- =============================================
-- 12. STORAGE — restrict delete to owners or admins
-- =============================================

DROP POLICY IF EXISTS "banners_auth_delete" ON storage.objects;
CREATE POLICY "banners_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND public.has_permission(auth.uid(), 'cms', 'delete'));

DROP POLICY IF EXISTS "assets_auth_delete" ON storage.objects;
CREATE POLICY "assets_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND public.has_permission(auth.uid(), 'cms', 'delete'));
