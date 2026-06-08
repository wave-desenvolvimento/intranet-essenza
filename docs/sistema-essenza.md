# Intranet Essenza — Documentação do Sistema

## Sobre o projeto

A Intranet Essenza é uma plataforma digital completa desenvolvida para a franqueadora Essenza (serra gaúcha), que nasceu da necessidade de centralizar a gestão de materiais de marketing e comunicação com franqueados, e evoluiu para uma intranet corporativa com módulos de pedidos, integração com ERP, pesquisas de satisfação e gestão completa da operação de franquias.

O sistema substitui processos que antes eram feitos por e-mail, WhatsApp e planilhas — unificando tudo numa plataforma acessível via web e mobile, com controle granular de permissões por perfil de usuário.

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router, React Server Components, Turbopack) |
| Estilização | Tailwind CSS com design system customizado (brand-olive, ink, etc.) |
| Componentes | Radix UI (Accordion, Dialog, Tooltip, Popover, etc.) |
| Backend | Supabase (PostgreSQL 17, Auth, Storage, Realtime, Row Level Security) |
| Automações | pg_cron (jobs agendados), pg_net (HTTP requests do banco) |
| Segurança | Supabase Vault (pgsodium) para encriptação de secrets |
| Deploy | Vercel (frontend) + Supabase Cloud (backend, East US Ohio) |
| Monitoramento | Betterstack (uptime), audit log interno |
| E-mail | Resend (transacional) |
| Push notifications | Web Push (VAPID) |

---

## Módulos do sistema

### 1. CMS (Content Management System)

O coração da plataforma. Permite criar e gerenciar qualquer tipo de conteúdo de forma dinâmica.

**Funcionalidades:**
- **Coleções dinâmicas** com campos configuráveis (14+ tipos: texto, rich text, imagem, arquivo, vídeo, data, cor, seletor de ícone, referência entre coleções, etc.)
- **Páginas compostas** por uma ou mais coleções, organizadas em seções na sidebar
- **3 tipos de visualização:** tabela (spreadsheet), galeria (cards visuais) e arquivos (lista)
- **Drag-and-drop** para reordenar páginas e seções
- **Sistema de campos** editável em tempo real — o admin monta a estrutura sem código
- **Versionamento** com histórico de alterações por item
- **Agendamento** de publicação e expiração de conteúdo
- **Busca full-text** em todos os conteúdos

**Exemplo de uso:** A equipe de marketing cadastra campanhas com imagens em múltiplos formatos (feed, stories, banner), textos, datas de validade. Os franqueados acessam, visualizam e baixam os materiais na resolução que precisam.

---

### 2. Biblioteca de Assets

Página centralizada que agrega todos os arquivos e imagens de todas as coleções do CMS num único lugar.

**Funcionalidades:**
- Listagem unificada de todos os assets do sistema (imagens, PDFs, documentos, vídeos)
- Filtros por tipo (imagens/arquivos), coleção de origem, status (vigentes/expirados)
- Busca por nome, coleção ou label
- Visualização em grid (thumbnails) ou lista
- Lightbox para imagens com zoom
- Download individual ou em lote (ZIP)
- Indicador visual de conteúdo expirado
- Link para a página original do asset

---

### 3. Templates Personalizáveis

Sistema de geração de materiais gráficos personalizados por franquia — o franqueado baixa banners, posts e artes já com seus dados (telefone, endereço, Instagram, etc.) automaticamente preenchidos.

**Funcionalidades:**
- Editor visual drag-and-drop para posicionar textos sobre imagens
- 21 variáveis dinâmicas (nome, cidade, endereço completo, CNPJ, redes sociais, etc.)
- 4 tipos de QR Code (WhatsApp, telefone, Instagram, website)
- Customização de fonte, cor, tamanho, alinhamento, background
- Preview em tempo real com dados da franquia do usuário logado
- Download em PNG na resolução original da imagem
- Compartilhamento direto via Web Share API (WhatsApp, etc.)
- Múltiplos aspect ratios (banner, quadrado, stories, etc.)

---

### 4. Módulo Comercial (Pedidos)

Fluxo completo de pedidos entre franqueados e a matriz.

**Funcionalidades:**
- **Catálogo de produtos** com SKU, categorias, imagens, status de estoque, pré-encomenda
- **Preços por segmento** (franquia vs multimarca) com tabelas separadas
- **Criação de pedidos** pelo franqueado com carrinho, condição de pagamento e tipo de frete
- **Gestão de pedidos** pelo comercial: aprovar, editar itens/valores, adicionar observações
- **Fluxo de status:** pendente → aprovado → confirmado → separação → faturado → entregue (ou cancelado)
- **Número OC** (Ordem de Compra) automático
- **Exportação** em texto, impressão e CSV
- **Estatísticas** de pedidos por franquia, produto e período

---

### 5. Integração ERP (Allcance)

Quando um pedido é aprovado, o sistema dispara automaticamente um webhook para o ERP Allcance com o payload no formato proprietário deles.

**Arquitetura:**
- Trigger PostgreSQL detecta mudança de status para "aprovado"
- Monta payload com joins de 6+ tabelas (franquia, produtos, preços, vendedor, condição de pagamento)
- Insere na fila (`webhook_queue`)
- pg_cron processa a fila a cada minuto
- HTTP POST via pg_net com headers de autenticação e idempotência
- Retry automático com backoff exponencial (5 tentativas)
- API key encriptada no Supabase Vault (nunca em texto puro)
- Monitoramento: status delivered/failed, histórico completo, reenvio manual

---

### 6. Gestão de Franquias

Cadastro e gestão completa das unidades franqueadas.

**Funcionalidades:**
- Cadastro com dados completos (endereço, contato, CNPJ, IE, redes sociais, responsável)
- Segmentação: franquia vs multimarca PDV
- Vendedor responsável vinculado (Comercial Matriz)
- Importação em massa via XLS (franquias + convite de usuários)
- Template XLS para download
- Aba de estoque por franquia com edição inline e alertas de estoque baixo
- Gestão de usuários por franquia (convite por e-mail, roles, ativar/desativar)

---

### 7. Comunicados

Sistema de comunicação interna com franqueados.

**Funcionalidades:**
- Rich text editor (Tiptap) para corpo do comunicado
- Upload de banner (imagem de capa)
- Prioridade: normal, urgente, fixado
- Targeting: todos, por segmento ou por franquia específica
- Tracking de leitura por usuário
- Cards de destaque no dashboard com accent bar, preview e CTA
- Expiração automática com cleanup (pg_cron)

---

### 8. FAQ

Central de perguntas frequentes com categorias e busca.

**Funcionalidades:**
- Categorias gerenciáveis
- Respostas em rich text
- Busca full-text
- Interface accordion expansível
- Permissões: qualquer usuário visualiza, admin gerencia

---

### 9. Pesquisas de Satisfação (NPS)

Coleta de feedback estruturado dos franqueados.

**Funcionalidades:**
- 4 tipos de pergunta: NPS (0-10), rating (1-5 estrelas), texto livre, escolha única
- Question builder na criação
- Cálculo NPS automático (promotores, neutros, detratores)
- Popup persistente: abre automaticamente ao acessar o sistema, incomoda até responder
- Modal de confirmação educativa ao tentar fechar
- Ícone no header com badge de pesquisas pendentes
- Dashboard com resultados e análise

---

### 10. Relatórios e Analytics

Painel de métricas de uso e vendas.

**Funcionalidades:**
- Cards de KPIs: visualizações, downloads, usuários ativos, faturamento, pedidos
- Comparação com período anterior (% variação)
- Filtro de período: 7 dias, 30 dias, 90 dias, este mês, mês anterior, este ano, personalizado
- 3 abas: Conteúdo (mais visualizados/baixados), Pedidos (por status, produto, franquia), Franquias (engajamento)
- Exportação XLS com seleção de seções
- Dados recarregam em tempo real ao mudar período

---

### 11. Permissões e Roles

Sistema granular de controle de acesso.

**Funcionalidades:**
- 7 roles pré-configurados: Owner, Operacional Matriz, Comercial Matriz, Admin Franquia, Usuário Franquia, Admin Matriz, Visualizador
- Permissões por módulo e ação (view, create, edit, delete, manage, approve, download, view_all)
- 12+ módulos: pedidos, produtos, relatórios, comunicados, histórico, FAQ, pesquisas, biblioteca, franquias, templates, usuários, CMS
- RLS (Row Level Security) em todas as tabelas
- Function `has_permission()` usada em policies e server actions
- Dev-mode para teste de permissões
- Sidebar 100% data-driven: mostra apenas o que o usuário tem acesso

---

### 12. Busca Global

Pesquisa unificada acessível via Cmd+K.

**Funcionalidades:**
- Busca em 9 módulos simultaneamente (em paralelo)
- Páginas, conteúdos CMS, franquias, produtos, pedidos, usuários, comunicados, FAQ, pesquisas
- Resultados agrupados por tipo com ícone e cor distintos
- Debounce de 300ms
- Navegação direta para o item encontrado

---

### 13. Audit Log

Histórico completo de ações no sistema.

**Funcionalidades:**
- Registro automático de criação, edição e exclusão
- Integrado em: franquias, usuários, pedidos, comunicados, estoque
- Campos: usuário, ação, entidade, descrição, changes (before/after em JSON)
- Paginação server-side (20/página)
- Filtros por tipo de entidade e ação
- Busca por texto
- Changes expandíveis mostrando campo → valor antigo → valor novo
- Limpeza automática registrada ("Sistema cron")

---

### 14. Infraestrutura e Automações

**Push Notifications:**
- Service Worker registrado
- VAPID keys configuradas
- Notificações por permissão ou por franquia

**Auto-cleanup (pg_cron):**
- Roda diariamente às 3h da manhã
- Remove itens CMS expirados + arquivos do Storage
- Remove comunicados expirados + banners
- Remove share links expirados
- Registra no audit log

**Monitoramento:**
- Betterstack para uptime
- Health checks periódicos
- Wave Monitor integrado

**Links compartilháveis:**
- Geração de links curtos (`/s/[code]`) com signed URLs
- Expiração em 24h
- Suporte a link único para múltiplos arquivos (página de galeria HTML)

---

## Números do sistema

| Métrica | Valor |
|---|---|
| Tabelas no banco | 39+ |
| Migrations | 44 |
| Módulos de permissão | 12+ |
| Roles configurados | 7 |
| Permissões individuais | 276+ |
| Tipos de campo CMS | 14+ |
| Variáveis de template | 21 + 4 QR |
| Coleções CMS | 12 |
| Páginas CMS | 26 |
| Cron jobs | 3 (webhook, cleanup, responses) |

---

## Segurança

- **RLS** em todas as tabelas públicas — dados filtrados no nível do banco
- **API keys** encriptadas no Supabase Vault (pgsodium)
- **Anon key** apenas no client, **service_role** apenas no server
- **Permissões** verificadas em server actions e policies
- **Auth** com PKCE flow + email confirmation
- **Storage** com buckets protegidos por RLS
- **Audit trail** completo de todas as ações administrativas

---

## Evolução do projeto

O projeto começou como um simples **gerenciador de assets** para compartilhar materiais de marketing com franqueados. A partir das necessidades reais da operação, evoluiu organicamente para uma intranet corporativa completa:

1. **Fase 1 — CMS e Assets:** Cadastro de materiais, categorias, download por franqueados
2. **Fase 2 — Permissões e Roles:** Controle granular de acesso por tipo de usuário
3. **Fase 3 — Pedidos:** Módulo comercial completo com catálogo, carrinho e gestão
4. **Fase 4 — Comunicação:** Comunicados, FAQ, pesquisas NPS
5. **Fase 5 — Integração:** Webhook com ERP Allcance, templates personalizáveis
6. **Fase 6 — Inteligência:** Relatórios com filtros de período, biblioteca centralizada, busca global, auto-cleanup

Toda a plataforma roda num stack enxuto (Next.js + Supabase), sem backend separado, sem infraestrutura complexa. As automações pesadas (webhooks, cleanup, retries) rodam direto no PostgreSQL via pg_cron e pg_net, eliminando a necessidade de workers externos ou filas de mensagens.

---

## Resultados e impacto

- **Centralização:** Todos os materiais, pedidos e comunicação num único lugar
- **Autonomia:** Franqueados acessam e baixam materiais personalizados sem depender da matriz
- **Controle:** Visibilidade total sobre quem acessa o quê, pedidos em andamento, engajamento
- **Eficiência:** Pedidos que antes eram por WhatsApp/e-mail agora têm fluxo estruturado com integração automática ao ERP
- **Escalabilidade:** Sistema preparado para crescer em número de franquias sem mudança de infraestrutura
- **Segurança:** Dados sensíveis protegidos com RLS, Vault e permissões granulares

---

*Desenvolvido por WaveCommerce — wesley@wavecommerce.com.br*
*Última atualização: Junho 2026*
