-- =============================================================
-- SEED: Franquias completas + mais conteúdo CMS (APENAS LOCAL)
-- =============================================================

-- ===== 1. COMPLETAR FRANQUIAS EXISTENTES =====
UPDATE franchises SET
  city = 'Bento Gonçalves', state = 'RS', segment = 'franquia',
  address = 'Rua Marechal Deodoro, 901', neighborhood = 'Centro', cep = '95700-000',
  phone = '(54) 3452-1001', whatsapp = '5554999001001', email = 'matriz@essenza.com.br',
  instagram = '@essenza.oficial', facebook = '/essenzaoficial',
  cnpj = '12.345.678/0001-01', manager_name = 'Roberto Essenza',
  opening_hours = 'Seg-Sex 8h-18h'
WHERE slug = 'essenza-matriz';

UPDATE franchises SET
  city = 'Caxias do Sul', state = 'RS', segment = 'franquia',
  address = 'Rua Sinimbu, 1340', neighborhood = 'Centro', cep = '95020-002',
  phone = '(54) 3221-4455', whatsapp = '5554999112233', email = 'caxias@essenza.com.br',
  instagram = '@essenza.caxias', facebook = '/essenzacaxias',
  cnpj = '12.345.678/0002-02', manager_name = 'Ana Martins',
  opening_hours = 'Seg-Sáb 9h-19h'
WHERE slug = 'essenza-caxias';

UPDATE franchises SET
  city = 'Gramado', state = 'RS', segment = 'franquia',
  address = 'Rua Coberta, 50', neighborhood = 'Centro', cep = '95670-000',
  phone = '(54) 3286-1234', whatsapp = '5554999334455', email = 'gramado@essenza.com.br',
  instagram = '@essenza.gramado', facebook = '/essenzagramado',
  cnpj = '12.345.678/0003-03', manager_name = 'Maria Silva',
  opening_hours = 'Todos os dias 9h-21h'
WHERE slug = 'essenza-gramado';

UPDATE franchises SET
  city = 'Carlos Barbosa', state = 'RS', segment = 'franquia',
  address = 'Rua Júlio de Castilhos, 200', neighborhood = 'Centro', cep = '95185-000',
  phone = '(54) 3461-2200', whatsapp = '5554999556677', email = 'carlosbarbosa@essenza.com.br',
  instagram = '@essenza.cb', cnpj = '12.345.678/0004-04', manager_name = 'Lucas Zanetti',
  opening_hours = 'Seg-Sáb 9h-18h'
WHERE slug = 'essenza-carlos-barbosa';

UPDATE franchises SET
  city = 'Garibaldi', state = 'RS', segment = 'franquia',
  address = 'Av. Rio Branco, 500', neighborhood = 'Centro', cep = '95720-000',
  phone = '(54) 3462-3300', whatsapp = '5554999778899', email = 'garibaldi@essenza.com.br',
  instagram = '@essenza.garibaldi', cnpj = '12.345.678/0005-05', manager_name = 'Fernanda Rech',
  opening_hours = 'Seg-Sáb 9h-18h'
WHERE slug = 'essenza-garibaldi';

-- ===== 2. NOVAS FRANQUIAS =====
INSERT INTO franchises (name, city, state, segment, status, address, neighborhood, cep, phone, whatsapp, email, instagram, cnpj, manager_name, opening_hours) VALUES
  ('Essenza Canela', 'Canela', 'RS', 'franquia', 'active', 'Av. Júlio de Castilhos, 800', 'Centro', '95680-000', '(54) 3282-5500', '5554999100200', 'canela@essenza.com.br', '@essenza.canela', '12.345.678/0006-06', 'Patrícia Menegotto', 'Todos os dias 9h-20h'),
  ('Essenza Flores da Cunha', 'Flores da Cunha', 'RS', 'franquia', 'active', 'Rua 25 de Julho, 300', 'Centro', '95270-000', '(54) 3292-1100', '5554999300400', 'flores@essenza.com.br', '@essenza.flores', '12.345.678/0007-07', 'Giovana Bianchini', 'Seg-Sáb 9h-18h'),
  ('Essenza Porto Alegre', 'Porto Alegre', 'RS', 'franquia', 'active', 'Rua Padre Chagas, 185', 'Moinhos de Vento', '90570-080', '(51) 3333-8800', '5551999500600', 'poa@essenza.com.br', '@essenza.poa', '12.345.678/0008-08', 'Rafael Bauer', 'Seg-Sáb 10h-20h'),
  ('Essenza Curitiba', 'Curitiba', 'PR', 'franquia', 'active', 'Rua XV de Novembro, 700', 'Centro', '80020-310', '(41) 3344-5566', '5541999700800', 'curitiba@essenza.com.br', '@essenza.cwb', '12.345.678/0009-09', 'Juliana Andrade', 'Seg-Sáb 9h-19h'),
  ('Essenza Balneário Camboriú', 'Balneário Camboriú', 'SC', 'franquia', 'active', 'Av. Atlântica, 2000', 'Centro', '88330-027', '(47) 3366-7788', '5547999900100', 'bc@essenza.com.br', '@essenza.bc', '12.345.678/0010-10', 'Thiago Souza', 'Todos os dias 10h-22h'),
  ('Café Arte Multimarca', 'São Paulo', 'SP', 'multimarca_pdv', 'active', 'Rua Oscar Freire, 900', 'Jardins', '01426-001', '(11) 3081-4400', '5511999200300', 'cafearte@email.com', '@cafearte.sp', '98.765.432/0001-01', 'Marcos Oliveira', 'Seg-Sáb 8h-20h'),
  ('Empório Serra Gaúcha', 'Farroupilha', 'RS', 'multimarca_pdv', 'active', 'Rua 14 de Julho, 150', 'Centro', '95180-000', '(54) 3268-1500', '5554999400500', 'emporio@serra.com.br', '@emporioserra', '98.765.432/0002-02', 'Cláudia Pereira', 'Seg-Sáb 9h-18h'),
  ('Essenza Florianópolis', 'Florianópolis', 'SC', 'franquia', 'inactive', 'Rua Felipe Schmidt, 400', 'Centro', '88010-000', '(48) 3222-3344', '5548999600700', 'floripa@essenza.com.br', '@essenza.floripa', '12.345.678/0011-11', 'Daniela Costa', 'Seg-Sáb 9h-19h')
ON CONFLICT DO NOTHING;

-- ===== 3. MAIS CMS ITEMS (conteúdos variados) =====
DO $$
DECLARE
  v_col_id uuid;
BEGIN
  -- Mais materiais PDV
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'materiais-pdv';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Cardápio Inverno 2026", "descricao": "Menu especial para a temporada de inverno", "categoria": "Cardápios"}', 'published'),
    (v_col_id, '{"titulo": "Display Balcão Café Gourmet", "descricao": "Display em acrílico para balcão de atendimento", "categoria": "Displays"}', 'published'),
    (v_col_id, '{"titulo": "Adesivo Vitrine Promoção", "descricao": "Adesivo para vitrine com layout de promoção", "categoria": "Adesivos"}', 'published'),
    (v_col_id, '{"titulo": "Banner Roll-up Institucional", "descricao": "Banner roll-up 80x200cm com identidade visual", "categoria": "Banners"}', 'published'),
    (v_col_id, '{"titulo": "Embalagem Presente Natal", "descricao": "Kit embalagem especial para Natal 2026", "categoria": "Embalagens"}', 'published'),
    (v_col_id, '{"titulo": "Folder Linha Chás", "descricao": "Folder triplo apresentando a linha completa de chás", "categoria": "Folders"}', 'published'),
    (v_col_id, '{"titulo": "Sacola Kraft Personalizada", "descricao": "Sacola kraft com logo Essenza", "categoria": "Embalagens"}', 'published'),
    (v_col_id, '{"titulo": "Cartão Fidelidade 2026", "descricao": "Novo layout do cartão fidelidade", "categoria": "Cartões"}', 'published');

  -- Mais posts de campanha
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'posts-campanha';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Campanha Dia das Mães 2026", "descricao": "Kit visual completo para Dia das Mães", "tipo": "Sazonal"}', 'published'),
    (v_col_id, '{"titulo": "Black Friday Essenza", "descricao": "Materiais para Black Friday 2026", "tipo": "Sazonal"}', 'published'),
    (v_col_id, '{"titulo": "Lançamento Linha Premium", "descricao": "Campanha de lançamento da nova linha premium", "tipo": "Lançamento"}', 'published'),
    (v_col_id, '{"titulo": "Semana do Café Especial", "descricao": "Promoção especial com descontos em cafés", "tipo": "Promoção"}', 'published'),
    (v_col_id, '{"titulo": "Campanha Sustentabilidade", "descricao": "Comunicação sobre ações sustentáveis", "tipo": "Institucional"}', 'published'),
    (v_col_id, '{"titulo": "Programa de Indicação", "descricao": "Materiais para programa indique e ganhe", "tipo": "Promoção"}', 'published');

  -- Mais posts redes sociais
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'posts-redes';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Carrossel Métodos de Preparo", "descricao": "10 slides sobre métodos de preparo de café"}', 'published'),
    (v_col_id, '{"titulo": "Reels Bastidores Torrefação", "descricao": "Vídeo vertical mostrando o processo de torrefação"}', 'published'),
    (v_col_id, '{"titulo": "Stories Kit Dia dos Pais", "descricao": "Sequência de stories para Dia dos Pais"}', 'published'),
    (v_col_id, '{"titulo": "Post Curiosidades do Café", "descricao": "Post educativo sobre curiosidades"}', 'published'),
    (v_col_id, '{"titulo": "Feed Harmonização Café+Chocolate", "descricao": "Post sobre harmonização de café com chocolate"}', 'published'),
    (v_col_id, '{"titulo": "Carrossel Benefícios do Chá Verde", "descricao": "8 slides sobre benefícios do chá verde"}', 'published');

  -- Mais fotos
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'fotos';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Fotos Produtos Linha Premium", "descricao": "Ensaio fotográfico da nova linha premium"}', 'published'),
    (v_col_id, '{"titulo": "Ambientação Loja Modelo", "descricao": "Fotos da loja modelo para referência de layout"}', 'published'),
    (v_col_id, '{"titulo": "Fotos Evento Lançamento", "descricao": "Registro do evento de lançamento 2026"}', 'published'),
    (v_col_id, '{"titulo": "Pack Fotos Natal", "descricao": "Ensaio natalino com produtos e decoração"}', 'published'),
    (v_col_id, '{"titulo": "Fotos Equipe Nacional", "descricao": "Fotos oficiais da equipe de todas as unidades"}', 'published');

  -- Mais vídeos
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'videos';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Vídeo Institucional 2026", "descricao": "Novo vídeo institucional da marca Essenza"}', 'published'),
    (v_col_id, '{"titulo": "Tutorial Preparo Espresso", "descricao": "Como preparar o espresso perfeito com produtos Essenza"}', 'published'),
    (v_col_id, '{"titulo": "Tour Virtual Fábrica", "descricao": "Conheça o processo de produção do café Essenza"}', 'published'),
    (v_col_id, '{"titulo": "Depoimentos Franqueados", "descricao": "Franqueados contam sua experiência com a marca"}', 'published');

  -- Mais cursos
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'cursos';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Curso Barista Essenza", "descricao": "Formação completa em preparo de cafés especiais"}', 'published'),
    (v_col_id, '{"titulo": "Atendimento ao Cliente", "descricao": "Treinamento padrão de atendimento Essenza"}', 'published'),
    (v_col_id, '{"titulo": "Gestão de Estoque PDV", "descricao": "Como gerir estoque na sua franquia"}', 'published');

  -- Assets da marca
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'assets-marca';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Manual de Identidade Visual v3", "descricao": "Versão atualizada do manual de marca"}', 'published'),
    (v_col_id, '{"titulo": "Paleta de Cores 2026", "descricao": "Cores oficiais atualizadas para 2026"}', 'published'),
    (v_col_id, '{"titulo": "Tipografia Oficial", "descricao": "Fontes oficiais para uso em materiais"}', 'published'),
    (v_col_id, '{"titulo": "Logo em Alta Resolução", "descricao": "Todas as versões do logo em SVG, PNG e PDF"}', 'published');

  -- Docs CIGAM
  SELECT id INTO v_col_id FROM cms_collections WHERE slug = 'docs-cigam';
  INSERT INTO cms_items (collection_id, data, status) VALUES
    (v_col_id, '{"titulo": "Manual Pedido de Compra", "descricao": "Passo a passo para criar pedido no CIGAM"}', 'published'),
    (v_col_id, '{"titulo": "Cadastro de Produtos", "descricao": "Como cadastrar produtos no sistema CIGAM"}', 'published'),
    (v_col_id, '{"titulo": "Relatório de Vendas CIGAM", "descricao": "Gerando relatórios de vendas no CIGAM"}', 'published');

  RAISE NOTICE 'Seed conteúdo: +45 CMS items adicionados';
END $$;

-- ===== 4. MAIS ANALYTICS para os novos items e franquias =====
DO $$
DECLARE
  v_user_id uuid;
  v_franchise_ids uuid[];
  v_item_ids uuid[];
  v_franchise uuid;
  v_item uuid;
  v_days_ago int;
  i int;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  SELECT array_agg(id) INTO v_franchise_ids FROM franchises;
  SELECT array_agg(id) INTO v_item_ids FROM cms_items;

  FOR i IN 1..400 LOOP
    v_franchise := v_franchise_ids[1 + floor(random() * array_length(v_franchise_ids, 1))::int];
    v_item := v_item_ids[1 + floor(random() * array_length(v_item_ids, 1))::int];
    v_days_ago := floor(random() * 55)::int;

    INSERT INTO analytics_events (user_id, franchise_id, item_id, collection_id, event_type, created_at)
    SELECT v_user_id, v_franchise, v_item, ci.collection_id,
      CASE WHEN random() < 0.6 THEN 'view' ELSE 'download' END,
      now() - (v_days_ago || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    FROM cms_items ci WHERE ci.id = v_item;
  END LOOP;

  RAISE NOTICE 'Seed analytics: +400 eventos para novos conteúdos e franquias';
END $$;
