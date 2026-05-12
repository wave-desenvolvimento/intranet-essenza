-- =============================================
-- 1. COMUNICADOS / MURAL
-- =============================================

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'pinned')),
  target_type text NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'segment', 'franchise')),
  target_value text, -- segment name or franchise_id when target_type != 'all'
  author_id uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_announcements_created ON public.announcements(created_at DESC);
CREATE INDEX idx_announcements_priority ON public.announcements(priority);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read announcements targeted to them
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT TO authenticated
  USING (
    target_type = 'all'
    OR (target_type = 'segment' AND target_value = (
      SELECT f.segment FROM profiles p JOIN franchises f ON f.id = p.franchise_id WHERE p.id = auth.uid()
    ))
    OR (target_type = 'franchise' AND target_value = (
      SELECT franchise_id::text FROM profiles WHERE id = auth.uid()
    ))
    OR author_id = auth.uid()
    OR public.has_permission(auth.uid(), 'comunicados', 'view_all')
  );

CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'comunicados', 'create'));

CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'comunicados', 'edit'));

CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'comunicados', 'delete'));

-- Read tracking
CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reads_select" ON public.announcement_reads FOR SELECT TO authenticated USING (true);
CREATE POLICY "reads_insert" ON public.announcement_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================
-- 2. CONTROLE DE ESTOQUE BÁSICO
-- =============================================

CREATE TABLE public.franchise_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 0,
  min_quantity int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (franchise_id, product_id)
);

CREATE INDEX idx_franchise_stock_franchise ON public.franchise_stock(franchise_id);
CREATE INDEX idx_franchise_stock_low ON public.franchise_stock(franchise_id) WHERE quantity <= min_quantity;

ALTER TABLE public.franchise_stock ENABLE ROW LEVEL SECURITY;

-- Select: own franchise or has franquias.view
CREATE POLICY "stock_select" ON public.franchise_stock FOR SELECT TO authenticated
  USING (
    franchise_id IN (SELECT franchise_id FROM profiles WHERE id = auth.uid())
    OR public.has_permission(auth.uid(), 'franquias', 'view')
  );

-- Insert/Update: own franchise admin or has produtos.edit
CREATE POLICY "stock_insert" ON public.franchise_stock FOR INSERT TO authenticated
  WITH CHECK (
    (franchise_id IN (SELECT franchise_id FROM profiles WHERE id = auth.uid() AND is_franchise_admin = true))
    OR public.has_permission(auth.uid(), 'produtos', 'edit')
  );

CREATE POLICY "stock_update" ON public.franchise_stock FOR UPDATE TO authenticated
  USING (
    (franchise_id IN (SELECT franchise_id FROM profiles WHERE id = auth.uid() AND is_franchise_admin = true))
    OR public.has_permission(auth.uid(), 'produtos', 'edit')
  );

CREATE POLICY "stock_delete" ON public.franchise_stock FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'produtos', 'edit'));

-- =============================================
-- 3. AUDIT LOG
-- =============================================

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'invite', 'login')),
  entity_type text NOT NULL, -- 'order', 'product', 'user', 'franchise', 'announcement', 'cms_item', etc
  entity_id text,
  description text NOT NULL,
  changes jsonb, -- { field: { old: x, new: y } }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only users with historico.view can read
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'historico', 'view'));

-- Insert via server actions (authenticated users can log their own actions)
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 4. PERMISSIONS
-- =============================================

INSERT INTO public.permissions (module, action, description) VALUES
  ('comunicados', 'view', 'Ver comunicados'),
  ('comunicados', 'view_all', 'Ver todos os comunicados (admin)'),
  ('comunicados', 'create', 'Criar comunicado'),
  ('comunicados', 'edit', 'Editar comunicado'),
  ('comunicados', 'delete', 'Remover comunicado'),
  ('historico', 'view', 'Ver histórico de ações')
ON CONFLICT (module, action) DO NOTHING;

-- Grant comunicados + historico permissions to Owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'owner' AND p.module IN ('comunicados', 'historico')
ON CONFLICT DO NOTHING;

-- Grant comunicados.create to Operacional Matriz
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'operacional' AND p.module = 'comunicados' AND p.action IN ('view', 'view_all', 'create', 'edit')
ON CONFLICT DO NOTHING;

-- =============================================
-- 5. SYSTEM PAGE: Comunicados
-- =============================================

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module)
VALUES ('Comunicados', 'comunicados', 'megaphone', 55, (SELECT id FROM cms_pages WHERE slug = 'comercial'), 'system', '/comunicados', 'comunicados');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module)
VALUES ('Histórico', 'historico', 'history', 906, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/configuracoes/audit', 'historico');
