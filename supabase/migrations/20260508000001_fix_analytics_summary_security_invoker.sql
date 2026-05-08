-- Fix: analytics_summary was using SECURITY DEFINER (default), bypassing RLS.
-- Switch to SECURITY INVOKER so RLS on analytics_events is enforced for the querying user.
alter view public.analytics_summary set (security_invoker = on);
