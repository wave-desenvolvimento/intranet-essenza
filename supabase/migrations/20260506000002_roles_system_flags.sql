-- Add system flags to roles
-- slug: internal identifier (immutable, used by code logic)
-- is_system: true = role do sistema (não pode ser deletado, não pode ser atribuído por franchise admin)
-- level: hierarquia numérica (maior = mais poder). Usado pra impedir user de atribuir role acima do seu

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 0;

-- Set slugs and levels for existing roles
-- Level guide: 100=superadmin, 90=owner, 80=admin, 50=comercial, 30=franchise_admin, 10=franchise_user, 0=viewer
UPDATE public.roles SET slug = 'admin', is_system = true, level = 80 WHERE name = 'admin';
UPDATE public.roles SET slug = 'superadmin', is_system = true, level = 100 WHERE name = 'superadmin';
UPDATE public.roles SET slug = 'owner', is_system = true, level = 90 WHERE name = 'Owner';
UPDATE public.roles SET slug = 'operacional', is_system = true, level = 70 WHERE name = 'Operacional Matriz';
UPDATE public.roles SET slug = 'comercial_sistema', is_system = true, level = 50 WHERE name = 'Comercial Matriz';
UPDATE public.roles SET slug = 'admin_franquia', is_system = false, level = 30 WHERE name = 'Admin Franquia';
UPDATE public.roles SET slug = 'franqueado', is_system = false, level = 10 WHERE name = 'franqueado';
UPDATE public.roles SET slug = 'comercial', is_system = false, level = 50 WHERE name = 'comercial';
UPDATE public.roles SET slug = 'usuario_franquia', is_system = false, level = 10 WHERE name = 'Usuário Franquia';
UPDATE public.roles SET slug = 'visualizador', is_system = false, level = 0 WHERE name = 'Visualizador';

-- For any roles without slug, generate from name
UPDATE public.roles SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]', '_', 'g'))
WHERE slug IS NULL;

-- Make slug not null now
ALTER TABLE public.roles ALTER COLUMN slug SET NOT NULL;

-- RPC: check if user is system admin (replaces hardcoded role name checks)
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.is_system = true AND r.level >= 80
  );
END;
$$;

-- RPC: get user's max role level
CREATE OR REPLACE FUNCTION public.get_user_role_level(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_level int;
BEGIN
  SELECT COALESCE(MAX(r.level), 0) INTO max_level
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id;
  RETURN max_level;
END;
$$;

-- Update RLS policies to use the new function instead of hardcoded names

-- Analytics: replace hardcoded admin check
DROP POLICY IF EXISTS "Admins can read analytics" ON public.analytics_events;
CREATE POLICY "Admins can read analytics" ON public.analytics_events FOR SELECT
  USING (public.is_system_admin(auth.uid()));

-- Orders: replace hardcoded admin check
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
  USING (
    franchise_id IN (SELECT franchise_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_system_admin(auth.uid())
  );
