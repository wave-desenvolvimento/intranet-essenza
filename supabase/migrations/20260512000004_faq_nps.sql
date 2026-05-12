-- =============================================
-- 1. FAQ / BASE DE CONHECIMENTO
-- =============================================

CREATE TABLE public.faq_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text DEFAULT 'folder',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.faq_categories(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_faq_items_category ON public.faq_items(category_id);
CREATE INDEX idx_faq_items_published ON public.faq_items(published) WHERE published = true;

ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faq_categories_select" ON public.faq_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "faq_categories_insert" ON public.faq_categories FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'faq', 'create'));
CREATE POLICY "faq_categories_update" ON public.faq_categories FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'faq', 'edit'));
CREATE POLICY "faq_categories_delete" ON public.faq_categories FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'faq', 'delete'));

CREATE POLICY "faq_items_select" ON public.faq_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "faq_items_insert" ON public.faq_items FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'faq', 'create'));
CREATE POLICY "faq_items_update" ON public.faq_items FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'faq', 'edit'));
CREATE POLICY "faq_items_delete" ON public.faq_items FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'faq', 'delete'));

-- =============================================
-- 2. NPS / PESQUISA DE SATISFAÇÃO
-- =============================================

CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  franchise_id uuid REFERENCES public.franchises(id),
  score int NOT NULL CHECK (score >= 0 AND score <= 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);

CREATE INDEX idx_survey_responses_survey ON public.survey_responses(survey_id);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Everyone sees active surveys
CREATE POLICY "surveys_select" ON public.surveys FOR SELECT TO authenticated USING (true);
CREATE POLICY "surveys_insert" ON public.surveys FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'pesquisas', 'create'));
CREATE POLICY "surveys_update" ON public.surveys FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'pesquisas', 'edit'));
CREATE POLICY "surveys_delete" ON public.surveys FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'pesquisas', 'delete'));

-- Users can see own responses, admins see all
CREATE POLICY "responses_select" ON public.survey_responses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'pesquisas', 'view_all')
  );
CREATE POLICY "responses_insert" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- 3. PERMISSIONS
-- =============================================

INSERT INTO public.permissions (module, action, description) VALUES
  ('faq', 'view', 'Ver FAQ'),
  ('faq', 'create', 'Criar pergunta FAQ'),
  ('faq', 'edit', 'Editar pergunta FAQ'),
  ('faq', 'delete', 'Remover pergunta FAQ'),
  ('pesquisas', 'view', 'Ver pesquisas'),
  ('pesquisas', 'view_all', 'Ver todas as respostas'),
  ('pesquisas', 'create', 'Criar pesquisa'),
  ('pesquisas', 'edit', 'Editar pesquisa'),
  ('pesquisas', 'delete', 'Remover pesquisa')
ON CONFLICT (module, action) DO NOTHING;

-- Grant to Owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.slug = 'owner' AND p.module IN ('faq', 'pesquisas')
ON CONFLICT DO NOTHING;

-- Grant FAQ view to all roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE p.module = 'faq' AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- Grant pesquisas view to all roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE p.module = 'pesquisas' AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. SYSTEM PAGES
-- =============================================

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module)
VALUES ('FAQ', 'faq', 'book', 56, (SELECT id FROM cms_pages WHERE slug = 'comercial'), 'system', '/faq', 'faq');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module)
VALUES ('Pesquisas', 'pesquisas', 'bar-chart', 907, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/pesquisas', 'pesquisas');
