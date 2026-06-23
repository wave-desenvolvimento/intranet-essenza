-- =============================================
-- PAGE VIEWS TRACKING
-- Rastreia navegação por módulo/página por usuário e franquia
-- =============================================

CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  page_path text NOT NULL,        -- ex: /inicio, /pedidos, /pagina/campanhas
  module text NOT NULL,            -- ex: inicio, pedidos, campanhas, cms
  page_title text,                 -- título legível da página
  session_id text,                 -- agrupar por sessão
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes otimizados para queries de relatório
CREATE INDEX idx_page_views_user ON public.page_views(user_id, created_at DESC);
CREATE INDEX idx_page_views_franchise ON public.page_views(franchise_id, created_at DESC);
CREATE INDEX idx_page_views_module ON public.page_views(module, created_at DESC);
CREATE INDEX idx_page_views_date ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_franchise_module ON public.page_views(franchise_id, module);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own page views
CREATE POLICY "page_views_insert" ON public.page_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only users with relatorios.view can read all page views
CREATE POLICY "page_views_select" ON public.page_views FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'relatorios', 'view'));

-- =============================================
-- Add 'page_view' and 'login' to analytics_events event_type
-- (allows tracking logins in the same events table)
-- =============================================

-- Cleanup: auto-delete page_views older than 6 months (pg_cron)
-- This will be added to the existing cleanup cron if desired
