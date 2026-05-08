-- =============================================
-- SEED: Monitors por grupo/provedor
-- =============================================

insert into public.monitors (name, group_name, description, url, method, headers, expected_status, interval_minutes, sort_order) values
  -- Essenza Hub (APIs internas)
  (
    'Aplicação',
    'Essenza Hub',
    'Saúde geral da aplicação (DB + Auth + Storage)',
    'https://intranet-essenza.vercel.app/api/health',
    'GET', '{}', 200, 5, 0
  ),
  (
    'API de Armazenamento',
    'Essenza Hub',
    'Upload e download de arquivos',
    'https://intranet-essenza.vercel.app/api/health/storage',
    'GET', '{}', 200, 5, 1
  ),

  -- Vercel
  (
    'Hosting',
    'Vercel',
    'Hospedagem e CDN da aplicação',
    'https://intranet-essenza.vercel.app/login',
    'GET', '{}', 200, 5, 10
  ),

  -- Supabase
  (
    'Banco de Dados',
    'Supabase',
    'PostgreSQL — armazenamento principal de dados',
    'https://vahjdglapjrjkgncbkze.supabase.co/rest/v1/?select=1',
    'GET', '{"apikey": "SUBSTITUIR_PELA_ANON_KEY"}', 200, 5, 20
  ),
  (
    'Autenticação',
    'Supabase',
    'Login, cadastro e gerenciamento de sessões',
    'https://vahjdglapjrjkgncbkze.supabase.co/auth/v1/health',
    'GET', '{}', 200, 5, 21
  ),
  (
    'Storage',
    'Supabase',
    'Armazenamento de imagens e arquivos',
    'https://intranet-essenza.vercel.app/api/health/storage',
    'GET', '{}', 200, 5, 22
  ),
  (
    'Realtime',
    'Supabase',
    'Notificações e atualizações em tempo real',
    'https://vahjdglapjrjkgncbkze.supabase.co/realtime/v1/health',
    'GET', '{}', 200, 5, 23
  ),

  -- Resend
  (
    'API de Email',
    'Resend',
    'Envio de emails transacionais (convites, pedidos)',
    'https://api.resend.com/health',
    'GET', '{}', 200, 5, 30
  )
on conflict do nothing;
