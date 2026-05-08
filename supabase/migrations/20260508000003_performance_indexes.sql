-- Performance indexes for RLS and frequent queries

-- Speed up has_permission() RPC — called on every row via RLS
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module_action ON public.permissions(module, action);

-- Speed up RLS franchise check: SELECT franchise_id FROM profiles WHERE id = auth.uid()
CREATE INDEX IF NOT EXISTS idx_profiles_id_franchise ON public.profiles(id, franchise_id);

-- Speed up is_system_admin() RPC — called on every row via RLS
CREATE INDEX IF NOT EXISTS idx_roles_system_level ON public.roles(is_system, level);

-- Speed up cms_items filtered by collection + status (most common query)
CREATE INDEX IF NOT EXISTS idx_cms_items_collection_status ON public.cms_items(collection_id, status);

-- Compound index for user_roles lookups (used in every permission check)
CREATE INDEX IF NOT EXISTS idx_user_roles_compound ON public.user_roles(user_id, role_id);
