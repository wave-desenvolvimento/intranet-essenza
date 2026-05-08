-- =============================================
-- SEED: Monitors padrão
-- =============================================

insert into public.monitors (name, url, method, headers, expected_status, interval_minutes, sort_order) values
  (
    'Essenza Hub',
    'https://intranet-essenza.vercel.app/api/health',
    'GET',
    '{}',
    200,
    5,
    0
  ),
  (
    'Banco de Dados',
    'https://vahjdglapjrjkgncbkze.supabase.co/rest/v1/?select=1',
    'GET',
    '{"apikey": "SUBSTITUIR_PELA_ANON_KEY"}',
    200,
    5,
    1
  ),
  (
    'Autenticação',
    'https://vahjdglapjrjkgncbkze.supabase.co/auth/v1/health',
    'GET',
    '{}',
    200,
    5,
    2
  ),
  (
    'Armazenamento',
    'https://intranet-essenza.vercel.app/api/health/storage',
    'GET',
    '{}',
    200,
    5,
    3
  )
on conflict do nothing;
