-- Registra a página de leads na sidebar (grupo Comercial)
INSERT INTO public.cms_pages (title, slug, icon, sort_order, parent_id, page_type, href, module)
VALUES (
  'Leads Revenda',
  'leads',
  'user-plus',
  54,
  (SELECT id FROM cms_pages WHERE slug = 'comercial'),
  'system',
  '/leads',
  'leads'
);
