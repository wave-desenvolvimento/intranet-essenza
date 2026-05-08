-- Generic permission check function (replaces role-name-based checks)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.module = _module AND p.action = _action
  );
END;
$$;

-- Orders: own franchise OR has pedidos.view_all
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
  USING (
    franchise_id IN (SELECT franchise_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_permission(auth.uid(), 'pedidos', 'view_all')
  );

-- Analytics: has analytics.view
DROP POLICY IF EXISTS "Admins can read analytics" ON public.analytics_events;
CREATE POLICY "Admins can read analytics" ON public.analytics_events FOR SELECT
  USING (public.has_permission(auth.uid(), 'analytics', 'view'));
