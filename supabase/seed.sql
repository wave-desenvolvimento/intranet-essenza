-- =============================================
-- SEED: Permissões e Roles pré-definidos
-- =============================================

-- Módulos e ações (derivados da sidebar)
insert into public.permissions (module, action, description) values
  -- Dashboard
  ('dashboard', 'view', 'Ver dashboard'),
  -- Usuários
  ('usuarios', 'view', 'Ver lista de usuários'),
  ('usuarios', 'create', 'Criar usuário'),
  ('usuarios', 'edit', 'Editar usuário'),
  ('usuarios', 'delete', 'Remover usuário'),
  ('usuarios', 'manage', 'Gerenciar roles e permissões'),
  -- CMS
  ('cms', 'view', 'Ver CMS'),
  ('cms', 'create', 'Criar conteúdo CMS'),
  ('cms', 'edit', 'Editar conteúdo CMS'),
  ('cms', 'delete', 'Remover conteúdo CMS'),
  -- Universo da Marca
  ('universo-da-marca', 'view', 'Ver universo da marca'),
  ('universo-da-marca', 'create', 'Criar item'),
  ('universo-da-marca', 'edit', 'Editar item'),
  ('universo-da-marca', 'delete', 'Remover item'),
  -- Material Corporativo
  ('material-corporativo', 'view', 'Ver materiais corporativos'),
  ('material-corporativo', 'create', 'Subir material'),
  ('material-corporativo', 'edit', 'Editar material'),
  ('material-corporativo', 'delete', 'Remover material'),
  ('material-corporativo', 'download', 'Baixar material'),
  -- Campanhas
  ('campanhas', 'view', 'Ver campanhas'),
  ('campanhas', 'create', 'Criar campanha'),
  ('campanhas', 'edit', 'Editar campanha'),
  ('campanhas', 'delete', 'Remover campanha'),
  ('campanhas', 'download', 'Baixar materiais de campanha'),
  -- Redes Sociais
  ('redes-sociais', 'view', 'Ver redes sociais'),
  ('redes-sociais', 'create', 'Criar post'),
  ('redes-sociais', 'edit', 'Editar post'),
  ('redes-sociais', 'delete', 'Remover post'),
  ('redes-sociais', 'download', 'Baixar assets de redes sociais'),
  -- Biblioteca
  ('biblioteca', 'view', 'Ver biblioteca de imagens'),
  ('biblioteca', 'create', 'Subir imagem'),
  ('biblioteca', 'edit', 'Editar imagem'),
  ('biblioteca', 'delete', 'Remover imagem'),
  ('biblioteca', 'download', 'Baixar imagem'),
  -- Vídeos
  ('videos', 'view', 'Ver vídeos'),
  ('videos', 'create', 'Subir vídeo'),
  ('videos', 'edit', 'Editar vídeo'),
  ('videos', 'delete', 'Remover vídeo'),
  ('videos', 'download', 'Baixar vídeo'),
  -- Treinamento on-line
  ('treinamento', 'view', 'Ver treinamentos'),
  ('treinamento', 'create', 'Criar treinamento'),
  ('treinamento', 'edit', 'Editar treinamento'),
  ('treinamento', 'delete', 'Remover treinamento'),
  -- CIGAM
  ('cigam', 'view', 'Ver CIGAM'),
  ('cigam', 'create', 'Criar item CIGAM'),
  ('cigam', 'edit', 'Editar item CIGAM'),
  ('cigam', 'delete', 'Remover item CIGAM'),
  -- Configurações
  ('configuracoes', 'view', 'Ver configurações'),
  ('configuracoes', 'edit', 'Editar configurações'),
  -- Pedidos
  ('orders', 'view', 'Ver pedidos'),
  ('orders', 'create', 'Criar pedido'),
  ('orders', 'approve', 'Aprovar e gerenciar pedidos'),
  ('orders', 'export', 'Exportar pedidos'),
  ('orders', 'delete', 'Cancelar pedidos'),
  -- Produtos
  ('products', 'view', 'Ver produtos'),
  ('products', 'edit', 'Editar produtos'),
  ('products', 'delete', 'Remover produtos'),
  -- Franquias
  ('franquias', 'view', 'Ver franquias'),
  ('franquias', 'create', 'Criar franquia'),
  ('franquias', 'edit', 'Editar franquia'),
  ('franquias', 'delete', 'Remover franquia'),
  -- Templates
  ('templates', 'view', 'Ver templates'),
  ('templates', 'create', 'Criar template'),
  ('templates', 'edit', 'Editar template'),
  ('templates', 'delete', 'Remover template'),
  -- Relatórios
  ('relatorios', 'view', 'Ver relatórios')
on conflict (module, action) do nothing;

-- Roles pré-definidos
insert into public.roles (name, slug, description, is_default, is_system, level) values
  -- Matriz
  ('Owner', 'owner', 'Acesso total ao sistema — superadmin da franqueadora', false, true, 90),
  ('Operacional Matriz', 'operacional', 'Gestão de campanhas, materiais, treinamentos e CMS', false, true, 70),
  ('Comercial Matriz', 'comercial_sistema', 'Foco em redes sociais, biblioteca, vídeos e relatórios', false, true, 50),
  -- Franquias
  ('Admin Franquia', 'admin_franquia', 'Gerencia usuários e visualiza tudo da sua franquia', false, false, 30),
  ('Usuário Franquia', 'usuario_franquia', 'Acesso básico — visualização e download de materiais', true, false, 10),
  ('Visualizador', 'visualizador', 'Apenas visualização, sem download', false, false, 0);

-- Owner: todas as permissões
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Owner';

-- Operacional Matriz: campanhas, materiais, treinamento, CMS, universo da marca, dashboard
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Operacional Matriz'
  and (
    p.module in ('dashboard', 'campanhas', 'material-corporativo', 'universo-da-marca', 'treinamento', 'cigam', 'cms', 'biblioteca', 'videos')
    or (p.module = 'usuarios' and p.action = 'view')
  );

-- Comercial Matriz: redes sociais, biblioteca, vídeos, campanhas (view), dashboard
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Comercial Matriz'
  and (
    p.module in ('dashboard', 'redes-sociais', 'biblioteca', 'videos')
    or (p.module in ('campanhas', 'material-corporativo', 'universo-da-marca') and p.action in ('view', 'download'))
    or (p.module = 'usuarios' and p.action = 'view')
  );

-- Admin Franquia: view + download de tudo + gerencia users da franquia
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Admin Franquia'
  and (
    (p.action in ('view', 'download') and p.module not in ('configuracoes', 'cms'))
    or (p.module = 'usuarios' and p.action in ('view', 'create', 'edit'))
    or (p.module = 'dashboard' and p.action = 'view')
  );

-- Usuário Franquia: view + download (sem users, config, cms)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Usuário Franquia'
  and p.action in ('view', 'download')
  and p.module not in ('usuarios', 'configuracoes', 'cms');

-- Visualizador: apenas view (sem users, config, cms)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'Visualizador'
  and p.action = 'view'
  and p.module not in ('usuarios', 'configuracoes', 'cms');

-- =============================================
-- SEED: Franquias
-- =============================================
insert into public.franchises (name, city, status, segment, slug) values
  ('Essenza Matriz', 'Bento Gonçalves', 'active', 'franquia', 'essenza-matriz'),
  ('Essenza Caxias', 'Caxias do Sul', 'active', 'franquia', 'essenza-caxias'),
  ('Essenza Gramado', 'Gramado', 'active', 'franquia', 'essenza-gramado'),
  ('Essenza Carlos Barbosa', 'Carlos Barbosa', 'active', 'multimarca_pdv', 'essenza-carlos-barbosa'),
  ('Essenza Garibaldi', 'Garibaldi', 'active', 'multimarca_pdv', 'essenza-garibaldi');

-- =============================================
-- SEED: CMS Collections + Fields
-- =============================================

-- Collection: Banners (carousel do dashboard)
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Banners', 'banners', 'Banners do carousel do dashboard', 'image', 0);

insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'banners'), 'Badge', 'badge', 'text', true, 0, 'Ex: Promoção do Mês'),
  ((select id from cms_collections where slug = 'banners'), 'Título', 'titulo', 'text', true, 1, 'Ex: Oferta Secreta'),
  ((select id from cms_collections where slug = 'banners'), 'Descrição', 'descricao', 'textarea', true, 2, 'Descrição curta do banner'),
  ((select id from cms_collections where slug = 'banners'), 'Cor inicial', 'cor_inicio', 'color', true, 3, null),
  ((select id from cms_collections where slug = 'banners'), 'Cor final', 'cor_fim', 'color', true, 4, null),
  ((select id from cms_collections where slug = 'banners'), 'Texto do botão', 'cta_texto', 'text', false, 5, 'Ex: Ver materiais'),
  ((select id from cms_collections where slug = 'banners'), 'Link do botão', 'cta_link', 'url', false, 6, 'Ex: /campanhas'),
  ((select id from cms_collections where slug = 'banners'), 'Imagem Desktop', 'imagem_desktop', 'image', false, 7, null),
  ((select id from cms_collections where slug = 'banners'), 'Imagem Mobile', 'imagem_mobile', 'image', false, 8, null);

-- Collection: Categorias de Materiais
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Categorias de Materiais', 'categorias-materiais', 'Categorias para organizar materiais corporativos', 'folder', 1);

insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order) values
  ((select id from cms_collections where slug = 'categorias-materiais'), 'Nome', 'nome', 'text', true, 0),
  ((select id from cms_collections where slug = 'categorias-materiais'), 'Descrição', 'descricao', 'textarea', false, 1),
  ((select id from cms_collections where slug = 'categorias-materiais'), 'Ícone', 'icone', 'icon_select', false, 2),
  ((select id from cms_collections where slug = 'categorias-materiais'), 'Ativa', 'ativa', 'boolean', true, 3);

-- Collection: Categorias de Campanhas
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Categorias de Campanhas', 'categorias-campanhas', 'Tipos de campanha (Sazonal, Lançamento, Promoção, etc)', 'megaphone', 2);

insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order) values
  ((select id from cms_collections where slug = 'categorias-campanhas'), 'Nome', 'nome', 'text', true, 0),
  ((select id from cms_collections where slug = 'categorias-campanhas'), 'Cor', 'cor', 'color', false, 1),
  ((select id from cms_collections where slug = 'categorias-campanhas'), 'Ativa', 'ativa', 'boolean', true, 2);

-- Items de exemplo: Banners
insert into public.cms_items (collection_id, data, status, sort_order) values
  (
    (select id from cms_collections where slug = 'banners'),
    '{"badge": "Promoção do Mês", "titulo": "Oferta Secreta", "descricao": "Campanha exclusiva de maio com condições especiais para toda a rede.", "cor_inicio": "#7a5c3e", "cor_fim": "#c4a67a", "cta_texto": "Ver materiais", "cta_link": "/campanhas"}',
    'published', 0
  ),
  (
    (select id from cms_collections where slug = 'banners'),
    '{"badge": "Campanha Sazonal", "titulo": "Dia das Mães 2026", "descricao": "Kits especiais, displays e materiais para divulgação.", "cor_inicio": "#5a4a3a", "cor_fim": "#9a8a6a", "cta_texto": "Ver materiais", "cta_link": "/campanhas"}',
    'published', 1
  ),
  (
    (select id from cms_collections where slug = 'banners'),
    '{"badge": "Lançamento", "titulo": "Linha Valentina", "descricao": "Nova fragrância com materiais de PDV disponíveis.", "cor_inicio": "#7a3a4a", "cor_fim": "#c4856a", "cta_texto": "Ver materiais", "cta_link": "/campanhas"}',
    'published', 2
  );

-- Items de exemplo: Categorias de Materiais
insert into public.cms_items (collection_id, data, status, sort_order) values
  (
    (select id from cms_collections where slug = 'categorias-materiais'),
    '{"nome": "Displays PDV", "descricao": "Displays em acrílico, MDF e papelão para ponto de venda", "icone": "monitor", "ativa": true}',
    'published', 0
  ),
  (
    (select id from cms_collections where slug = 'categorias-materiais'),
    '{"nome": "Embalagens", "descricao": "Sacolas, caixas e embalagens para presente", "icone": "package", "ativa": true}',
    'published', 1
  );

-- Items de exemplo: Categorias de Campanhas
insert into public.cms_items (collection_id, data, status, sort_order) values
  (
    (select id from cms_collections where slug = 'categorias-campanhas'),
    '{"nome": "Sazonal", "cor": "#7a5c2b", "ativa": true}',
    'published', 0
  ),
  (
    (select id from cms_collections where slug = 'categorias-campanhas'),
    '{"nome": "Lançamento", "cor": "#7a3a4a", "ativa": true}',
    'published', 1
  ),
  (
    (select id from cms_collections where slug = 'categorias-campanhas'),
    '{"nome": "Promoção", "cor": "#2f4754", "ativa": true}',
    'published', 2
  );

-- Mais categorias de materiais
insert into public.cms_items (collection_id, data, status, sort_order) values
  (
    (select id from cms_collections where slug = 'categorias-materiais'),
    '{"nome": "Rótulos e Etiquetas", "descricao": "Rótulos para frascos e etiquetas de preço", "icone": "tag", "ativa": true}',
    'published', 2
  ),
  (
    (select id from cms_collections where slug = 'categorias-materiais'),
    '{"nome": "Material de Vitrine", "descricao": "Adesivos, banners e displays para vitrine", "icone": "image", "ativa": true}',
    'published', 3
  );

-- =============================================
-- SEED: Conteúdo de exemplo (placeholder)
-- =============================================

-- =============================================
-- SEED: Collections de dados estruturados (puras)
-- =============================================

-- Assets da Marca
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Assets da Marca', 'assets-marca', 'Logos, guidelines e identidade visual', 'layers', 3);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'assets-marca'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'assets-marca'), 'Descrição', 'descricao', 'rich_text', false, 1, null),
  ((select id from cms_collections where slug = 'assets-marca'), 'Vídeo (YouTube)', 'video', 'url', false, 2, 'https://youtube.com/watch?v=...'),
  ((select id from cms_collections where slug = 'assets-marca'), 'Duração', 'duracao', 'duration', false, 3, null),
  ((select id from cms_collections where slug = 'assets-marca'), 'Material PDF', 'pdf', 'file', false, 4, null),
  ((select id from cms_collections where slug = 'assets-marca'), 'Categoria', 'categoria', 'collection_multi_ref', false, 5, null);

-- Materiais PDV
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Materiais PDV', 'materiais-pdv', 'Displays, embalagens e materiais de ponto de venda', 'file', 4);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Descrição', 'descricao', 'rich_text', false, 1, null),
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Categoria', 'categoria', 'collection_multi_ref', false, 2, null),
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Arquivo', 'arquivo', 'file', false, 3, null),
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Imagem', 'imagem', 'image', false, 4, null),
  ((select id from cms_collections where slug = 'materiais-pdv'), 'Data', 'data', 'date', false, 5, null);

-- Posts de Campanha
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Posts de Campanha', 'posts-campanha', 'Materiais e posts de campanhas', 'megaphone', 5);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'posts-campanha'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Imagem', 'imagem', 'image', false, 1, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Descrição', 'descricao', 'rich_text', false, 2, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Produto', 'produto', 'text', false, 3, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Tipo', 'tipo', 'collection_multi_ref', false, 4, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Data início', 'data_inicio', 'date', false, 5, null),
  ((select id from cms_collections where slug = 'posts-campanha'), 'Data fim', 'data_fim', 'date', false, 6, null);

-- Posts Redes Sociais
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Posts Redes Sociais', 'posts-redes', 'Posts, stories e conteúdo para redes sociais', 'database', 6);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'posts-redes'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'posts-redes'), 'Plataforma', 'plataforma', 'text', false, 1, 'Ex: Instagram, Facebook'),
  ((select id from cms_collections where slug = 'posts-redes'), 'Data', 'data', 'date', false, 2, null),
  ((select id from cms_collections where slug = 'posts-redes'), 'Imagem', 'imagem', 'image', false, 3, null),
  ((select id from cms_collections where slug = 'posts-redes'), 'Arquivo', 'arquivo', 'file', false, 4, null);

-- Fotos (banco de imagens)
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Fotos', 'fotos', 'Banco de imagens e fotos de produtos', 'image', 7);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'fotos'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'fotos'), 'Tags', 'tags', 'text', false, 1, 'Ex: produto, lifestyle, PDV'),
  ((select id from cms_collections where slug = 'fotos'), 'Imagem', 'imagem', 'image', true, 2, null);

-- Vídeos
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Vídeos', 'videos', 'Vídeos institucionais, tutoriais e conteúdo audiovisual', 'database', 8);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'videos'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'videos'), 'Descrição', 'descricao', 'rich_text', false, 1, null),
  ((select id from cms_collections where slug = 'videos'), 'URL', 'url', 'url', true, 2, 'Link do YouTube ou Vimeo'),
  ((select id from cms_collections where slug = 'videos'), 'Thumbnail', 'thumbnail', 'image', false, 3, null);

-- Cursos
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Cursos', 'cursos', 'Cursos e materiais de treinamento', 'database', 9);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'cursos'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'cursos'), 'Descrição', 'descricao', 'rich_text', false, 1, null),
  ((select id from cms_collections where slug = 'cursos'), 'Tipo', 'tipo', 'text', false, 2, 'Ex: Produto, Vendas'),
  ((select id from cms_collections where slug = 'cursos'), 'URL do vídeo', 'url_video', 'url', false, 3, null),
  ((select id from cms_collections where slug = 'cursos'), 'Material PDF', 'material_pdf', 'file', false, 4, null),
  ((select id from cms_collections where slug = 'cursos'), 'Imagem', 'imagem', 'image', false, 5, null);

-- Documentação CIGAM
insert into public.cms_collections (name, slug, description, icon, sort_order) values
  ('Documentação CIGAM', 'docs-cigam', 'Materiais e documentação do sistema CIGAM', 'database', 10);
insert into public.cms_fields (collection_id, name, slug, field_type, required, sort_order, placeholder) values
  ((select id from cms_collections where slug = 'docs-cigam'), 'Título', 'titulo', 'text', true, 0, null),
  ((select id from cms_collections where slug = 'docs-cigam'), 'Descrição', 'descricao', 'rich_text', false, 1, null),
  ((select id from cms_collections where slug = 'docs-cigam'), 'Arquivo', 'arquivo', 'file', false, 2, null);

-- =============================================
-- SEED: Pages (navegação na sidebar)
-- =============================================

-- Agrupadores
insert into public.cms_pages (title, slug, icon, sort_order, is_group) values
  ('Conteúdo', 'conteudo', 'layers', 100, true),
  ('Mídia', 'midia', 'image', 200, true),
  ('Treinamento', 'treinamento-grupo', 'database', 300, true);

-- Pages de Conteúdo
insert into public.cms_pages (title, slug, icon, view_type, sort_order, parent_id) values
  ('Universo da Marca', 'universo-da-marca', 'layers', 'course', 101, (select id from cms_pages where slug = 'conteudo')),
  ('Material Corporativo', 'material-corporativo', 'file', 'files', 102, (select id from cms_pages where slug = 'conteudo')),
  ('Campanhas', 'campanhas', 'megaphone', 'gallery', 103, (select id from cms_pages where slug = 'conteudo')),
  ('Redes Sociais', 'redes-sociais', 'database', 'table', 104, (select id from cms_pages where slug = 'conteudo'));

-- Pages de Mídia
insert into public.cms_pages (title, slug, icon, view_type, sort_order, parent_id) values
  ('Biblioteca', 'biblioteca', 'image', 'gallery', 201, (select id from cms_pages where slug = 'midia')),
  ('Vídeos', 'videos', 'database', 'table', 202, (select id from cms_pages where slug = 'midia'));

-- Pages de Treinamento
insert into public.cms_pages (title, slug, icon, view_type, sort_order, parent_id) values
  ('Treinamento on-line', 'treinamento', 'database', 'course', 301, (select id from cms_pages where slug = 'treinamento-grupo')),
  ('CIGAM', 'cigam', 'database', 'files', 302, (select id from cms_pages where slug = 'treinamento-grupo'));

-- Vínculos page <-> collection
insert into public.cms_page_collections (page_id, collection_id, role) values
  ((select id from cms_pages where slug = 'universo-da-marca'), (select id from cms_collections where slug = 'assets-marca'), 'main'),
  ((select id from cms_pages where slug = 'material-corporativo'), (select id from cms_collections where slug = 'materiais-pdv'), 'main'),
  ((select id from cms_pages where slug = 'material-corporativo'), (select id from cms_collections where slug = 'categorias-materiais'), 'filter'),
  ((select id from cms_pages where slug = 'campanhas'), (select id from cms_collections where slug = 'posts-campanha'), 'main'),
  ((select id from cms_pages where slug = 'campanhas'), (select id from cms_collections where slug = 'categorias-campanhas'), 'filter'),
  ((select id from cms_pages where slug = 'redes-sociais'), (select id from cms_collections where slug = 'posts-redes'), 'main'),
  ((select id from cms_pages where slug = 'biblioteca'), (select id from cms_collections where slug = 'fotos'), 'main'),
  ((select id from cms_pages where slug = 'videos'), (select id from cms_collections where slug = 'videos'), 'main'),
  ((select id from cms_pages where slug = 'treinamento'), (select id from cms_collections where slug = 'cursos'), 'main'),
  ((select id from cms_pages where slug = 'cigam'), (select id from cms_collections where slug = 'docs-cigam'), 'main');

-- Configurar collection_ref: apontar campo pra collection de referência
update public.cms_fields set options = '{"collection_slug": "categorias-materiais"}'
  where slug = 'categoria' and collection_id = (select id from cms_collections where slug = 'assets-marca');
update public.cms_fields set options = '{"collection_slug": "categorias-materiais"}'
  where slug = 'categoria' and collection_id = (select id from cms_collections where slug = 'materiais-pdv');
update public.cms_fields set options = '{"collection_slug": "categorias-campanhas"}'
  where slug = 'tipo' and collection_id = (select id from cms_collections where slug = 'posts-campanha');

-- =============================================
-- SEED: Conteúdo de exemplo
-- =============================================
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Display Ana Carolina Jorge", "descricao": "Arte para displays ACJ em acrílico 21x15cm.", "categoria": [], "data": "2026-04-22"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'materiais-pdv';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Display Extraoldinário", "descricao": "Artes para display em acrílico Extraoldinário.", "categoria": [], "data": "2026-04-22"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'materiais-pdv';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Display Linha Casa", "descricao": "Display (21x15cm) com artes para mesa.", "categoria": [], "data": "2026-03-26"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'materiais-pdv';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Sacola Presente P", "descricao": "Sacola de presente tamanho P.", "categoria": [], "data": "2026-03-15"}'::jsonb, 'published', 3 from cms_collections c where c.slug = 'materiais-pdv';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Etiqueta de Preço Padrão", "descricao": "Etiqueta padrão da rede.", "categoria": [], "data": "2026-02-10"}'::jsonb, 'published', 4 from cms_collections c where c.slug = 'materiais-pdv';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Boas-vindas à Essenza", "descricao": "Conheça a história, o propósito e o universo da Essenza.", "video": "", "duracao": "4:12", "categoria": []}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'assets-marca';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Identidade de marca", "descricao": "Paleta de cores, tipografia e tom de voz da marca.", "video": "", "duracao": "6:40", "categoria": []}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'assets-marca';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Atendimento ao cliente", "descricao": "Padrão de excelência no atendimento Essenza.", "video": "", "duracao": "5:28", "categoria": []}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'assets-marca';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Processos de loja", "descricao": "Rotinas e processos operacionais da franquia.", "video": "", "duracao": "8:15", "categoria": []}'::jsonb, 'published', 3 from cms_collections c where c.slug = 'assets-marca';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Vendas consultivas", "descricao": "Técnicas de venda consultiva para perfumaria.", "video": "", "duracao": "7:02", "categoria": []}'::jsonb, 'published', 4 from cms_collections c where c.slug = 'assets-marca';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Dia das Mães 2026", "descricao": "<p>Campanha completa com posts, stories e display para PDV.</p>", "produto": "Kit Presente Essenza", "tipo": [], "data_inicio": "2026-04-25", "data_fim": "2026-05-11"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'posts-campanha';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Oferta Secreta Maio", "descricao": "<p>Promoção exclusiva com desconto progressivo.</p>", "produto": "Óleo Hidratante Antioxidante Uva Vegana 140ml", "tipo": [], "data_inicio": "2026-05-01", "data_fim": "2026-05-31"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'posts-campanha';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Lançamento Valentina", "descricao": "<p>Nova fragrância floral com notas de jasmim e bergamota.</p>", "produto": "Valentina EDP 50ml", "tipo": [], "data_inicio": "2026-04-01", "data_fim": "2026-06-30"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'posts-campanha';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Campanha Grape", "descricao": "<p>Linha completa de cuidados com extrato de uva.</p>", "produto": "Difusor Sementes 350ml", "tipo": [], "data_inicio": "2026-03-01", "data_fim": "2026-04-30"}'::jsonb, 'published', 3 from cms_collections c where c.slug = 'posts-campanha';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Vitrines 2026", "descricao": "<p>Guia de montagem de vitrines para franquias.</p>", "produto": "Linha Casa", "tipo": [], "data_inicio": "2026-01-01", "data_fim": "2026-12-31"}'::jsonb, 'published', 4 from cms_collections c where c.slug = 'posts-campanha';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Posts semana 05/05", "plataforma": "Instagram", "data": "2026-05-05"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'posts-redes';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Stories Dia das Mães", "plataforma": "Instagram", "data": "2026-05-08"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'posts-redes';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Post Valentina Facebook", "plataforma": "Facebook", "data": "2026-04-28"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'posts-redes';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Reels Linha Casa", "plataforma": "Instagram", "data": "2026-04-20"}'::jsonb, 'published', 3 from cms_collections c where c.slug = 'posts-redes';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Produto - Valentina 100ml", "tags": "produto, valentina, perfume"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Lifestyle - Loja Gramado", "tags": "lifestyle, loja, gramado"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Produto - Extraoldinário 200ml", "tags": "produto, extraordinario"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Vitrine - Natal 2025", "tags": "vitrine, natal, decoracao"}'::jsonb, 'published', 3 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Embalagem - Kit Presente", "tags": "embalagem, kit, presente"}'::jsonb, 'published', 4 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "PDV - Display Mesa ACJ", "tags": "pdv, display, mesa, acj"}'::jsonb, 'published', 5 from cms_collections c where c.slug = 'fotos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Institucional Essenza 2026", "descricao": "Vídeo institucional.", "url": "https://youtube.com/watch?v=exemplo1"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'videos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Como montar o Display ACJ", "descricao": "Tutorial de montagem.", "url": "https://youtube.com/watch?v=exemplo2"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'videos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Apresentação Linha Valentina", "descricao": "Vídeo de lançamento.", "url": "https://youtube.com/watch?v=exemplo3"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'videos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Atendimento ao Cliente", "descricao": "Técnicas de atendimento.", "tipo": "Vendas", "url_video": "https://youtube.com/watch?v=curso1"}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'cursos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Conhecendo a Linha Casa", "descricao": "Produtos da Linha Casa.", "tipo": "Produto", "url_video": "https://youtube.com/watch?v=curso2"}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'cursos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Visual Merchandising", "descricao": "Organização de vitrine e PDV.", "tipo": "PDV", "url_video": "https://youtube.com/watch?v=curso3"}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'cursos';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Manual do Operador CIGAM", "descricao": "Guia para operação diária."}'::jsonb, 'published', 0 from cms_collections c where c.slug = 'docs-cigam';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Como emitir NF-e", "descricao": "Emissão de nota fiscal."}'::jsonb, 'published', 1 from cms_collections c where c.slug = 'docs-cigam';
insert into public.cms_items (collection_id, data, status, sort_order) select c.id, '{"titulo": "Controle de Estoque", "descricao": "Gestão de estoque no CIGAM."}'::jsonb, 'published', 2 from cms_collections c where c.slug = 'docs-cigam';

-- =============================================
-- SEED: Usuário de teste + notificações
-- Criado via script pós-seed (setup-test-user.sh)
-- =============================================
-- Notificações são inseridas após o usuário ser criado via Admin API.
-- Execute: bash scripts/setup-test-user.sh
