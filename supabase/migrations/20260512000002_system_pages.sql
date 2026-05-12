-- Add system page support to cms_pages
-- System pages have fixed routes (href) and permission checks (module/required_action)
-- CMS pages continue to route via /pagina/[slug]

ALTER TABLE public.cms_pages ADD COLUMN page_type text NOT NULL DEFAULT 'cms'
  CHECK (page_type IN ('cms', 'system'));
ALTER TABLE public.cms_pages ADD COLUMN href text;
ALTER TABLE public.cms_pages ADD COLUMN module text;
ALTER TABLE public.cms_pages ADD COLUMN required_action text;

-- Insert system pages that were previously hardcoded in the sidebar

-- Início (root, no group)
INSERT INTO public.cms_pages (title, slug, icon, sort_order, is_group, page_type, href, module) VALUES
  ('Início', 'inicio', 'layout-dashboard', 0, false, 'system', '/inicio', 'dashboard');

-- Comercial group
INSERT INTO public.cms_pages (title, slug, icon, sort_order, is_group, page_type) VALUES
  ('Comercial', 'comercial', 'shopping-cart', 50, true, 'system');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module) VALUES
  ('Novo Pedido', 'novo-pedido', 'shopping-cart', 51, (SELECT id FROM cms_pages WHERE slug = 'comercial'), 'system', '/novo-pedido', 'pedidos');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module, required_action) VALUES
  ('Gestão Pedidos', 'gestao-de-pedidos', 'package', 52, (SELECT id FROM cms_pages WHERE slug = 'comercial'), 'system', '/gestao-de-pedidos', 'pedidos', 'view_all');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module) VALUES
  ('Produtos', 'produtos', 'package', 53, (SELECT id FROM cms_pages WHERE slug = 'comercial'), 'system', '/produtos', 'produtos');

-- Administração group
INSERT INTO public.cms_pages (title, slug, icon, sort_order, is_group, page_type) VALUES
  ('Administração', 'administracao', 'settings', 900, true, 'system');

INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module) VALUES
  ('Franquias', 'franquias', 'building', 901, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/franquias', 'franquias'),
  ('Relatórios', 'relatorios', 'bar-chart', 902, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/relatorios', 'relatorios'),
  ('CMS', 'cms-admin', 'monitor-cog', 903, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/cms', 'cms'),
  ('Permissões', 'configuracoes', 'shield-check', 904, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/configuracoes', 'configuracoes'),
  ('Templates', 'templates', 'stamp', 905, (SELECT id FROM cms_pages WHERE slug = 'administracao'), 'system', '/templates', 'templates');
