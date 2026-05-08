-- Function to auto-publish and auto-expire CMS items based on scheduled dates
create or replace function public.cms_run_scheduler()
returns json
language plpgsql
security definer
as $$
declare
  published_count int;
  expired_count int;
begin
  -- Auto-publish: items scheduled to go live (draft + published_at <= now)
  update public.cms_items
  set status = 'published'
  where status = 'draft'
    and published_at is not null
    and published_at <= now();

  get diagnostics published_count = row_count;

  -- Auto-expire: items scheduled to expire (published + expires_at <= now)
  update public.cms_items
  set status = 'archived'
  where status = 'published'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;

  return json_build_object(
    'published', published_count,
    'expired', expired_count,
    'ran_at', now()
  );
end;
$$;

-- Enable pg_cron extension (if available on your Supabase plan)
-- create extension if not exists pg_cron with schema extensions;

-- Schedule to run every 5 minutes
-- select cron.schedule(
--   'cms-scheduler',
--   '*/5 * * * *',
--   $$select public.cms_run_scheduler()$$
-- );
