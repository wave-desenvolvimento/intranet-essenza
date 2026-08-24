-- Owner role bypasses ALL permission checks via RPCs
-- No application-level bypass needed - everything is driven by these functions

-- Helper: check if user has owner role
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.slug = 'owner'
  );
$$;

-- 1. has_permission: returns true if user is owner
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _module text,
  _action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.is_owner(_user_id)
    OR
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND p.module = _module
        AND p.action = _action
    );
$$;

-- 2. get_user_permissions: returns ALL permissions if user is owner
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE (module text, action text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.permissions p
  WHERE public.is_owner(_user_id)
  UNION
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
    AND NOT public.is_owner(_user_id);
$$;

-- 3. get_user_role_level: returns max int if user is owner (bypasses all level checks)
CREATE OR REPLACE FUNCTION public.get_user_role_level(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_level int;
BEGIN
  -- Owner bypasses all level restrictions
  IF public.is_owner(_user_id) THEN
    RETURN 2147483647;
  END IF;

  SELECT COALESCE(MAX(r.level), 0) INTO max_level
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id;
  RETURN max_level;
END;
$$;

-- Overload without param (uses auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_role_level()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.get_user_role_level(auth.uid());
END;
$$;

-- 4. RLS: owner bypasses user_roles level restrictions
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner(auth.uid())
    OR (
      public.has_permission(auth.uid(), 'usuarios', 'manage')
      AND public.get_user_role_level(auth.uid()) >= (SELECT level FROM public.roles WHERE id = role_id)
    )
  );

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_owner(auth.uid())
    OR (
      public.has_permission(auth.uid(), 'usuarios', 'manage')
      AND public.get_user_role_level(auth.uid()) >= (SELECT level FROM public.roles WHERE id = role_id)
    )
  );
