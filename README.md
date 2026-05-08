# Essenza Brand Hub

Brand Hub para a rede **Empório Essenza Serra Gaúcha**. Plataforma centralizada de gestão de campanhas, materiais, treinamentos, pedidos e usuários das lojas franqueadas.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Email | Resend + React Email |
| Deploy | Vercel |
| Font | Comfortaa (Google Fonts) |

## Funcionalidades

- **CMS dinâmico** — Collections com 15+ field types, 4 view types (gallery, files, table, course), drag-reorder, versionamento com revert, share links
- **Pages Manager** — Estrutura hierárquica de páginas com coleções vinculadas e roles (main/sidebar)
- **Módulo de Pedidos** — Catálogo com preços por segmento (franquia vs multimarca/PDV), carrinho, gestão admin com filtros/exports/status workflow
- **Templates** — Editor visual drag-and-drop com variáveis dinâmicas, QR codes, download PNG, share WhatsApp
- **Permissões granulares** — Sistema módulo.ação com roles hierárquicas e levels
- **Notificações** — In-app + Web Push com bell e unread count
- **Analytics** — Tracking de views/downloads, dashboard de métricas, relatórios de pedidos
- **PWA** — Manifest, ícones, responsivo 100% mobile, bottom nav, drawer
- **Tour guiado** — Onboarding interativo responsivo (desktop e mobile)

## Pré-requisitos

- Node.js 20+
- pnpm
- Docker (para Supabase local)

## Setup

```bash
# Instalar dependências
pnpm install

# Iniciar Supabase local + dev server
pnpm dev

# Criar usuário de teste
./scripts/setup-test-user.sh
```

### Variáveis de ambiente

Copie `.env.local.example` para `.env.local` (se existir) ou configure:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
COMMERCIAL_EMAIL=
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia Supabase local + Next.js dev |
| `pnpm build` | Build de produção |
| `pnpm start` | Servidor de produção |
| `pnpm lint` | ESLint |

## Estrutura

```
src/
├── app/
│   ├── (auth)/          # Login, reset password
│   ├── (dashboard)/     # Área logada (inicio, cms, pedidos, etc.)
│   ├── api/             # API routes (cron)
│   └── auth/            # Callback OAuth/SSO
├── components/
│   ├── layout/          # Sidebar, mobile nav, header, tour
│   └── ui/              # shadcn/ui components
├── hooks/               # usePermissions, usePagination, etc.
├── lib/
│   ├── supabase/        # Client, server, admin, middleware
│   ├── permissions.ts   # Guards: requireAuth, requirePermission
│   ├── rate-limit.ts    # Rate limiter in-memory
│   ├── push.ts          # Web Push (server-side)
│   ├── email.ts         # Resend client
│   └── download.ts      # File download utilities
└── emails/              # React Email templates
supabase/
└── migrations/          # SQL migrations (schema + RLS)
```

## Segurança

- RLS habilitado em todas as tabelas com `has_permission()` / `is_system_admin()`
- Auth + permission checks em todas as server actions
- DOMPurify em todo `dangerouslySetInnerHTML`
- Rate limiting em login (5/min) e reset password (3/5min)
- Zod validation nos inputs de autenticação
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Validação server-side de preços em pedidos
- SSRF protection em share links

---

Construído por [WaveCommerce](https://www.wavecommerce.com.br/?utm_source=readme&utm_medium=sistema-essenza)
