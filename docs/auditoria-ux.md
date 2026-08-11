# Auditoria de Usabilidade - Intranet Essenza

Data: 11/08/2026
Escopo: navegacao completa desktop (1440px) + mobile (390px) em todas as secoes

---

## Prioridade ALTA (impacto direto no uso diario)

### 1. Breadcrumb mostra slug tecnico em vez de titulo legivel
- **Onde:** /leads, /comunicados, /pesquisas, /suporte, /faq
- **Problema:** Breadcrumb mostra "leads", "comunicados", "pesquisas", "suporte", "faq" em minuscula crua (slug da rota), enquanto paginas CMS como /pagina/fotos mostram "Fotos" formatado. Inconsistencia visual.
- **Sugestao:** Normalizar todos os breadcrumbs para titulo com capitalize (ex: "Leads de Revenda", "Comunicados", "FAQ")

### 2. Cards de resumo na home nao sao clicaveis
- **Onde:** Dashboard /inicio - cards "Pedidos pendentes (3)", "Campanhas (1)", "Materiais (1)", "Usuarios ativos (10)"
- **Problema:** Os cards parecem clicaveis (tem icone, numero, subtexto) mas nao levam a lugar nenhum. O usuario espera clicar em "Pedidos pendentes" e ir pra gestao de pedidos filtrado por pendentes.
- **Sugestao:** Tornar cada card um link: Pedidos pendentes -> /gestao-de-pedidos?status=pendente, Campanhas -> /pagina/campanhas, Materiais -> /pagina/material-corporativo, Usuarios -> /franquias

### 3. Gestao de Pedidos filtra por mes atual e mostra 0 resultados por padrao
- **Onde:** /gestao-de-pedidos
- **Problema:** O filtro de data padrao e "01/08/2026 ate hoje" e mostra "0 pedidos". O header diz "7 pedidos - 3 pendentes" mas a tabela mostra vazio. O usuario abre a pagina e acha que nao tem pedidos. Precisa trocar o filtro manualmente.
- **Sugestao:** Filtro padrao deveria ser "Todos" ou pelo menos "Ultimos 30 dias" para que o usuario veja os pedidos ao entrar. Ou remover o filtro de data padrao.

### 4. Tabela de Leads esconde colunas importantes no desktop
- **Onde:** /leads - tabela em desktop 1440px
- **Problema:** A tabela mostra Nome, Contato, Localizacao, Origem, Status, Data. Mas as colunas Contato e Localizacao ocupam muito espaco e a coluna "Data" fica apertada. O chevron de expandir (>) nao tem label nem tooltip - nao comunica o que faz.
- **Sugestao:** Adicionar tooltip "Ver detalhes" no chevron de expand. Considerar mostrar email/telefone truncados com copy-on-click em vez de ocupar uma coluna inteira.

### 5. Pagina de Campanhas - card sem imagem de capa fica com fundo bege vazio
- **Onde:** /pagina/campanhas - card "Dia das Maes 2026"
- **Problema:** O card tem uma area grande bege claro sem nenhum conteudo visual - parece quebrado/incompleto. A descricao ("Campanha completa com posts, stories e display para PDV") aparece em texto pequeno cinza que quase nao se le.
- **Sugestao:** Quando nao tem imagem de capa, usar um placeholder com icone da categoria ou cor de fundo com o titulo em destaque. Aumentar o contraste da descricao.

### 6. Redes Sociais - card sem titulo nem imagem parece item fantasma
- **Onde:** /pagina/redes-sociais - segundo card (sem titulo, sem capa)
- **Problema:** Existe um card completamente vazio - sem titulo, sem imagem, sem descricao. So tem os icones de acao (favoritar, editar, deletar). Parece um bug. Provavelmente e um item com campos vazios que nao deveria ser exibido ou deveria ter um estado vazio melhor.
- **Sugestao:** Itens sem titulo e sem imagem deveriam ter um placeholder "Sem titulo" ou nao serem exibidos no front do franqueado.

---

## Prioridade MEDIA (polimento e consistencia)

### 7. Pesquisas - titulo "Pesquisas NPS" pode confundir
- **Onde:** /pesquisas
- **Problema:** O titulo diz "Pesquisas NPS" mas o sistema suporta 5 tipos de pergunta (nps, rating, text, choice, multiple_choice). Um franqueado que recebe uma pesquisa de satisfacao com perguntas de texto pode estranhar o titulo "NPS". Alem disso, a pesquisa "teste" com titulo generico aparece em producao.
- **Sugestao:** Renomear para "Pesquisas" (sem NPS). Limpar dados de teste.

### 8. Suporte - pagina vazia sem CTA nem orientacao
- **Onde:** /suporte
- **Problema:** Mostra "0 tickets" com tabela vazia e nenhuma acao disponivel. Nao tem botao "Novo Ticket" nem orientacao sobre como usar. O usuario entra e nao sabe o que fazer.
- **Sugestao:** Adicionar estado vazio com icone, texto explicativo ("Precisa de ajuda? Abra um ticket") e botao "Novo Ticket". Ou, se a feature nao esta pronta, esconder da sidebar.

### 9. Material Corporativo - cores de capa das pastas sem contraste com texto
- **Onde:** /pagina/material-corporativo - pastas Planogramas (verde claro sobre fundo rosa), Marketing (rosa), Comercial (bege)
- **Problema:** As cores de fundo das capas de pasta sao tons pastel claros. O texto do nome da pasta embaixo e preto e legivel, mas a area de imagem de capa e so uma cor solida sem informacao util - nao ajuda o usuario a distinguir as pastas visualmente.
- **Sugestao:** Se a capa e so uma cor solida, considerar mostrar o titulo da pasta sobreposto na area de cor, ou um icone grande. Cor solida sem informacao visual e desperdicio de espaco.

### 10. Botoes "Pasta" e "+ Novo" aparecem em paginas so-leitura do franqueado
- **Onde:** /pagina/fotos, /pagina/redes-sociais, /pagina/campanhas (quando logado como Owner)
- **Problema:** Correto para Owner. Mas verificar se esses botoes estao escondidos para franqueados sem permissao de criar. Se sim, ok. Se nao, e um problema de seguranca visual.
- **Verificar:** Logar como usuario franquia e confirmar que os botoes somem.

### 11. Produtos - tabela sem filtro por categoria
- **Onde:** /produtos - 350 produtos listados
- **Problema:** Sao 350 produtos numa lista unica com busca por nome/SKU apenas. Nao tem filtro por categoria, status, ou faixa de preco. Encontrar um produto especifico exige scroll ou busca exata.
- **Sugestao:** Adicionar filtro dropdown por categoria (ja existe a coluna "Categoria" na tabela). Considerar agrupamento tipo o accordion do /novo-pedido.

### 12. FAQ - botoes de acao (editar, deletar, expandir) sem diferenciacao visual
- **Onde:** /faq - icones a direita de cada pergunta
- **Problema:** Tres icones (lapis, lixeira, chevron) do mesmo tamanho e cor cinza claro, agrupados sem separacao. Facil clicar no errado - especialmente deletar sem querer quando queria expandir.
- **Sugestao:** Separar visualmente o chevron de expandir (que e a acao principal) dos botoes de edicao. O chevron deveria ser o unico elemento clicavel na area de conteudo; editar/deletar ficam num menu de contexto ou mais afastados.

---

## Prioridade BAIXA (refinamento visual)

### 13. Biblioteca - nomes de assets repetidos sem diferenciacao
- **Onde:** /biblioteca - 5 itens "Oliva - Fundo Branco" seguidos
- **Problema:** Todos os 5 primeiros cards se chamam "Oliva - Fundo Branco" com as mesmas tags "oliva, png, sem fundo". Nao da pra distinguir sem abrir cada um. A thumbnail e pequena demais pra ver a diferenca.
- **Sugestao:** Considerar mostrar resolucao (ex: "1200x800") ou tamanho do arquivo como diferenciador secundario.

### 14. Home - carrossel de banners sem auto-play nem indicador de conteudo
- **Onde:** /inicio - carrossel de campanhas
- **Problema:** O carrossel mostra um banner de campanha mas nao roda automaticamente. Tem setas de navegacao e dots mas o usuario pode nao perceber que tem mais conteudo. Os dots estao sobre a imagem com pouco contraste.
- **Sugestao:** Auto-play suave (5s) com pause on hover. Dots com fundo semi-transparente pra garantir contraste.

### 15. Home mobile - bottom nav "Pedidos" deveria ir para /novo-pedido ou /gestao-de-pedidos
- **Onde:** Mobile - barra inferior
- **Problema:** Precisa verificar pra onde o botao "Pedidos" leva. Se vai pra /novo-pedido (criar) e uma coisa; se vai pra /gestao-de-pedidos (listar) e outra. O icone de carrinho sugere "criar pedido".
- **Verificar:** Destino do link e se corresponde a expectativa.

### 16. Permissoes - modulo "suporte" em minuscula, inconsistente com os demais
- **Onde:** /configuracoes - lista de modulos
- **Problema:** Todos os modulos estao com primeira letra maiuscula (Biblioteca, CMS, FAQ, Franquias...) exceto "suporte" que esta em minuscula.
- **Sugestao:** Capitalizar pra "Suporte".

### 17. CMS - icones de acao na listagem de colecoes sao muitos e indistinguiveis
- **Onde:** /cms - cada linha de colecao tem 5 icones pequenos (lapis, engrenagem, copia, lixeira + algo)
- **Problema:** 5 icones de 14px lado a lado, todos cinza, sem tooltip visivel ate hover. Dificil saber qual faz o que sem testar.
- **Sugestao:** Reduzir para 2-3 acoes visiveis + menu "..." para as menos frequentes. Ou adicionar tooltips persistentes.

### 18. Comunicados - icones de acao (check, editar, deletar) muito sutis
- **Onde:** /comunicados - icones no canto superior direito do card
- **Problema:** Tres icones cinza claro de ~14px que so aparecem que sao clicaveis no hover. O check (marcar como lido) nao tem label visivel.
- **Sugestao:** Botao "Marcar como lido" com texto, ou pelo menos tooltip. Mover editar/deletar pra menu de contexto.

---

## Observacoes positivas

- **Sidebar bem organizada** com grupos claros (Administracao, Comercial, Conteudo, Midia, Treinamento)
- **Mobile excelente** - bottom nav com 4 acoes principais, layout responsivo sem quebra
- **Busca global** com atalho Cmd+K visivel no header
- **Curso (Universo da Marca)** funciona bem tanto em desktop quanto mobile, com sidebar de aulas responsiva
- **Leads** com cards de contagem clicaveis como filtro rapido - bom padrao
- **Novo Pedido** com accordion por categoria e busca - resolve bem 350 produtos
- **Templates** com preview visual e botoes "Ver" / "Baixar" claros
- **Relatorios** com tabs bem definidas e comparacao de periodo

---

## Proximos passos sugeridos

1. **Quick wins (< 1h cada):** #1 breadcrumbs, #6 item vazio, #16 capitalize suporte
2. **Melhorias de impacto (2-4h):** #2 cards clicaveis home, #3 filtro pedidos, #5 placeholder capa, #8 estado vazio suporte
3. **Refinamento (4-8h):** #4 tabela leads, #11 filtro produtos, #12 separar acoes FAQ, #17 menu contexto CMS
4. **Decisao de produto:** #7 renomear pesquisas, #10 verificar permissoes franqueado, #14 auto-play carrossel
