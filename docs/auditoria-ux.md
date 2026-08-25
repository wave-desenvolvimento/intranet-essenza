# Auditoria de Usabilidade - Intranet Essenza

Data: 11/08/2026
Escopo: navegacao completa desktop (1440px) + mobile (390px) em conteudo, CMS e modulos principais
Status: segunda passada, foco em affordance e simplificacao

---

## CORRIGIDOS nesta sessao

- [x] Breadcrumbs com titulo legivel (comunicados, pesquisas, leads, suporte, faq, audit)
- [x] Placeholder "Sem titulo" em italico para itens sem titulo
- [x] Modulo "suporte" capitalizado na tela de permissoes
- [x] Menu de contexto (3 pontinhos) de pasta: corrigido overflow cortando dropdown, posicionamento inteligente (abre pra cima quando falta espaco)
- [x] 3 pontinhos e grip handle sempre visiveis (sem depender de hover)
- [x] Drag de pasta separado do click: grip handle inicia drag, click no card entra na pasta

---

## Prioridade ALTA - impacto direto no uso

### 1. Cards de resumo na home nao sao clicaveis
- **Onde:** /inicio - "Pedidos pendentes (3)", "Campanhas (1)", "Materiais (1)", "Usuarios ativos (10)"
- **Problema:** Parecem botoes (cor, icone, numero) mas nao levam a nenhum lugar. Franqueado clica em "3 pedidos pendentes" e nada acontece.
- **Fix:** Link: Pedidos -> /gestao-de-pedidos, Campanhas -> /pagina/campanhas, Materiais -> /pagina/material-corporativo, Usuarios -> /franquias
- **Esforco:** ~30min

### 2. Gestao de Pedidos filtra por mes atual e mostra 0 por padrao
- **Onde:** /gestao-de-pedidos
- **Problema:** Header diz "7 pedidos - 3 pendentes" mas tabela mostra "0 pedidos" porque o filtro padrao e o mes atual. Usuario acha que nao tem pedidos.
- **Fix:** Remover filtro de data padrao ou usar "Todos" como default
- **Esforco:** ~20min

### 3. CMS Colecoes - 4 icones de acao por linha sem tooltip
- **Onde:** /cms - cada colecao tem 4 botoes (lapis, engrenagem, copia, lixeira) cinza de ~14px
- **Problema:** Impossivel saber qual e qual sem testar. Clicar no errado (lixeira) pode deletar a colecao.
- **Fix:** Trocar por menu de contexto (3 pontinhos) com labels textuais: "Editar", "Configurar campos", "Duplicar", "Remover". Mesmo padrao que implementamos nas pastas.
- **Esforco:** ~1h

### 4. CMS Collection Detail - data em formato ISO (2015-02-19)
- **Onde:** /cms/posts-redes - coluna DATA mostra "2015-02-19" e "2026-07-28"
- **Problema:** Formato ISO e ilegivel pra operador. E tem um item com data de 2015 que provavelmente e dado de teste.
- **Fix:** Formatar como "19/02/2015" ou "28 jul. 2026"
- **Esforco:** ~20min

### 5. CMS Collection Detail - item com titulo "-" (hifen)
- **Onde:** /cms/posts-redes - segundo item na lista, titulo "-"
- **Problema:** Parece item de teste/lixo. O campo PLATAFORMA tambem esta "-". Conteudo sujo confunde o operador.
- **Fix:** Validacao de titulo obrigatorio (campo required no CMS) + limpar dados de teste
- **Esforco:** ~15min (cleanup manual)

### 6. Campanhas - card sem imagem de capa fica vazio
- **Onde:** /pagina/campanhas - card "Dia das Maes 2026"
- **Problema:** Area grande bege sem nenhum conteudo visual. Parece quebrado.
- **Fix:** Quando nao tem capa (_cover), mostrar um placeholder com icone da colecao + titulo sobreposto. Ou usar o BrandLogo.
- **Esforco:** ~1h

### 7. Redes Sociais - item completamente vazio (fantasma)
- **Onde:** /pagina/redes-sociais - segundo item sem titulo, sem imagem, sem nada
- **Problema:** Card vazio com so icones de acao. Parece bug.
- **Fix:** Nao exibir itens onde TODOS os campos de conteudo (texto, imagem, image_array) estao vazios. Ou exigir titulo obrigatorio.
- **Esforco:** ~30min

---

## Prioridade MEDIA - polimento

### 8. CMS Pages - titulo "Pages" em ingles
- **Onde:** /cms > aba Paginas - titulo principal diz "Pages"
- **Problema:** Todo o sistema esta em portugues, esse titulo ficou em ingles.
- **Fix:** Trocar "Pages" por "Paginas"
- **Esforco:** ~5min

### 9. CMS Pages - acoes da secao (editar/deletar) muito sutis
- **Onde:** /cms > aba Paginas - cada grupo (ADMINISTRACAO, COMERCIAL, CONTEUDO) tem icones de lapis e lixeira ao lado do badge "Sistema"
- **Problema:** Icones de 14px cinza claro, facil nao ver. E misturados com o badge "Sistema" que tem a mesma cor.
- **Fix:** Dar mais destaque ou mover pro hover do header da secao
- **Esforco:** ~30min

### 10. Suporte - pagina vazia sem orientacao
- **Onde:** /suporte - "0 tickets" com tabela vazia e nenhuma acao
- **Problema:** O usuario entra e nao sabe o que fazer. Nao tem botao "Novo Ticket" nem texto explicativo.
- **Fix:** Empty state com icone + texto "Precisa de ajuda? Abra um ticket de suporte" + botao CTA. Ou esconder da sidebar se a feature nao esta ativa.
- **Esforco:** ~1h

### 11. Produtos - 350 itens sem filtro por categoria
- **Onde:** /produtos - lista longa com busca apenas por nome/SKU
- **Problema:** Scroll infinito por 350 produtos. Sem filtro por categoria, status ou faixa de preco.
- **Fix:** Dropdown de filtro por categoria (a coluna ja existe)
- **Esforco:** ~1h

### 12. FAQ - acoes de editar/deletar/expandir sem separacao visual
- **Onde:** /faq - 3 icones (lapis, lixeira, chevron) grudados a direita
- **Problema:** Facil clicar no errado. O chevron de expandir (acao principal) esta misturado com acoes destrutivas.
- **Fix:** Chevron na area de conteudo (clicavel no titulo/linha toda), editar/deletar em menu de contexto
- **Esforco:** ~1.5h

### 13. Pesquisas - titulo "Pesquisas NPS" pode confundir
- **Onde:** /pesquisas
- **Problema:** Titulo "Pesquisas NPS" mas o sistema suporta 5 tipos de pergunta. "NPS" e restritivo.
- **Fix:** Renomear para "Pesquisas"
- **Esforco:** ~5min

---

## Prioridade BAIXA - refinamento

### 14. Biblioteca - 5 itens "Oliva - Fundo Branco" iguais sem diferenciacao
- **Onde:** /biblioteca - primeiros 5 cards com mesmo nome e mesmas tags
- **Problema:** Impossivel distinguir sem abrir cada um
- **Fix:** Mostrar resolucao ou dimensao como diferenciador secundario
- **Esforco:** ~30min

### 15. Home - carrossel sem auto-play
- **Onde:** /inicio - banner de campanha
- **Problema:** Nao roda automaticamente. Dots com pouco contraste sobre a imagem.
- **Fix:** Auto-play 5s com pause on hover
- **Esforco:** ~30min

### 16. Material Corporativo - pastas com cor solida sem informacao
- **Onde:** /pagina/material-corporativo - Planogramas (bege), Marketing (rosa), Comercial (amarelo)
- **Problema:** A capa e so uma cor solida que nao ajuda a identificar o conteudo
- **Fix:** Icone grande ou titulo sobreposto na area de cor
- **Esforco:** ~1h

### 17. CMS Collection Detail - icones de acao por item sem tooltip
- **Onde:** /cms/<colecao> - 5 icones por linha (lapis, copia, olho, lixeira, etc.)
- **Problema:** Mesmo problema do #3 mas na tabela de itens. Icones pequenos sem label.
- **Fix:** Tooltips ou menu de contexto
- **Esforco:** ~30min

### 18. CMS Pages - subtitulo de cada pagina mostra slug tecnico
- **Onde:** /cms > Paginas - ex: "/configuracoes/audit - table - historico"
- **Problema:** Informacao tecnica (slug, view_type, modulo) exposta ao operador que nao precisa ver isso
- **Fix:** Esconder ou mostrar so no hover/expand, substituir por descricao amigavel
- **Esforco:** ~30min

---

## Observacoes positivas

- Sidebar organizada em grupos claros e data-driven
- Mobile com bottom nav funcional, layout sem quebra
- Busca global Cmd+K no header
- Curso com player + sidebar de aulas + progresso funciona bem
- Leads com cards de contagem como filtro rapido
- Novo Pedido com accordion por categoria resolve bem 350 SKUs
- Templates com preview visual e botoes claros
- Relatorios com tabs + comparacao de periodo
- Pastas estilo Google Drive com drag handle + menu de contexto + "Mover para..."
- Biblioteca agregando todos os assets com filtros

---

## Plano de execucao sugerido

**Batch 1 - rapido (<1h total):** #8 Pages em PT, #13 renomear pesquisas, #4 formato data, #5 limpar item teste
**Batch 2 - impacto alto (2-3h):** #1 cards clicaveis home, #2 filtro pedidos, #6 placeholder capa, #7 item vazio
**Batch 3 - polimento (3-4h):** #3 menu contexto CMS colecoes, #10 empty state suporte, #11 filtro produtos, #12 FAQ acoes
**Batch 4 - refinamento:** #14-18 conforme prioridade
