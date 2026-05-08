-- Enable pg_cron and schedule the CMS auto-publish/expire every 5 minutes
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cms-scheduler',
  '*/5 * * * *',
  $$select public.cms_run_scheduler()$$
);
