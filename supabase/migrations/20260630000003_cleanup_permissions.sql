-- =============================================
-- Limpeza de permissões: manter apenas ações pertinentes por módulo
-- =============================================

-- 1. Remove role_permissions que apontam para permissões que serão deletadas
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE
    -- dashboard: só view
    (module = 'dashboard' AND action NOT IN ('view'))
    -- pedidos: view, view_all, create, edit, approve, export, manage
    OR (module = 'pedidos' AND action NOT IN ('view', 'view_all', 'create', 'edit', 'approve', 'export', 'manage'))
    -- produtos: view, edit, delete
    OR (module = 'produtos' AND action NOT IN ('view', 'edit', 'delete'))
    -- leads: view, edit, delete, export
    OR (module = 'leads' AND action NOT IN ('view', 'edit', 'delete', 'export'))
    -- cms: view, create, edit, delete
    OR (module = 'cms' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- configuracoes: view, edit
    OR (module = 'configuracoes' AND action NOT IN ('view', 'edit'))
    -- franquias: view, create, edit, delete
    OR (module = 'franquias' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- relatorios: view, export
    OR (module = 'relatorios' AND action NOT IN ('view', 'export'))
    -- historico: view
    OR (module = 'historico' AND action NOT IN ('view'))
    -- comunicados: view, create, edit, delete
    OR (module = 'comunicados' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- pesquisas: view, create, edit, delete
    OR (module = 'pesquisas' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- faq: view, create, edit, delete
    OR (module = 'faq' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- templates: view, create, edit, delete
    OR (module = 'templates' AND action NOT IN ('view', 'create', 'edit', 'delete'))
    -- usuarios: view, create, edit, delete, manage
    OR (module = 'usuarios' AND action NOT IN ('view', 'create', 'edit', 'delete', 'manage'))
    -- biblioteca: view, download
    OR (module = 'biblioteca' AND action NOT IN ('view', 'download'))
    -- CMS pages dinâmicas: view, create, edit, download
    OR (module IN ('universo-da-marca', 'material-corporativo', 'campanhas', 'redes-sociais', 'fotos', 'videos', 'treinamento', 'cigam')
        AND action NOT IN ('view', 'create', 'edit', 'download'))
);

-- 2. Remove as permissões desnecessárias
DELETE FROM permissions WHERE
  (module = 'dashboard' AND action NOT IN ('view'))
  OR (module = 'pedidos' AND action NOT IN ('view', 'view_all', 'create', 'edit', 'approve', 'export', 'manage'))
  OR (module = 'produtos' AND action NOT IN ('view', 'edit', 'delete'))
  OR (module = 'leads' AND action NOT IN ('view', 'edit', 'delete', 'export'))
  OR (module = 'cms' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'configuracoes' AND action NOT IN ('view', 'edit'))
  OR (module = 'franquias' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'relatorios' AND action NOT IN ('view', 'export'))
  OR (module = 'historico' AND action NOT IN ('view'))
  OR (module = 'comunicados' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'pesquisas' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'faq' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'templates' AND action NOT IN ('view', 'create', 'edit', 'delete'))
  OR (module = 'usuarios' AND action NOT IN ('view', 'create', 'edit', 'delete', 'manage'))
  OR (module = 'biblioteca' AND action NOT IN ('view', 'download'))
  OR (module IN ('universo-da-marca', 'material-corporativo', 'campanhas', 'redes-sociais', 'fotos', 'videos', 'treinamento', 'cigam')
      AND action NOT IN ('view', 'create', 'edit', 'download'));

-- 3. Garante Owner (d328cef4) com TODAS as permissões restantes
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd328cef4-d42b-42f7-9124-b4d2bfbff308', p.id
FROM permissions p
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = 'd328cef4-d42b-42f7-9124-b4d2bfbff308'
  AND rp.permission_id = p.id
)
ON CONFLICT DO NOTHING;
