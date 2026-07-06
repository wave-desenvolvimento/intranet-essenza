-- Function to get emails from auth.users by IDs (SECURITY DEFINER = runs as owner, bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
$$;

-- Only service_role and postgres can call this (not authenticated users)
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM anon;
