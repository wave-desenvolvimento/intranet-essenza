-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. CMS scheduler: publish/expire items every 15 minutes (pure SQL)
SELECT cron.schedule(
  'cms-scheduler',
  '*/15 * * * *',
  $$SELECT public.cms_run_scheduler()$$
);

-- 2. Email reminders: daily at 10am via pg_net → Next.js API route
-- Requires DB settings:
--   ALTER DATABASE postgres SET app.site_url = 'https://your-site.vercel.app';
--   ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret';
SELECT cron.schedule(
  'email-reminders',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.site_url', true) || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
