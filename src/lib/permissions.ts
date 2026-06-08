import { createClient } from "@/lib/supabase/server";

// ---- Auth + Permission guards for server actions ----

/** Returns authenticated user or throws. Use in every server action. */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { user, supabase };
}

/** Checks permission. Returns { error } if denied, or { user, supabase } if allowed. */
export async function requirePermission(module: string, action: string) {
  const { user, supabase } = await requireAuth();
  const { data: allowed } = await supabase.rpc("has_permission", {
    _user_id: user.id,
    _module: module,
    _action: action,
  });
  if (!allowed) return { error: "Sem permissão", user: null, supabase: null };
  return { user, supabase, error: null };
}

/** @deprecated Use requirePermission("configuracoes", "edit") instead */
export async function requireSystemAdmin() {
  return requirePermission("configuracoes", "edit");
}

/** @deprecated RPC now uses auth.uid() internally — param is ignored */
export async function isSystemAdmin(_userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permission", {
    _user_id: _userId,
    _module: "configuracoes",
    _action: "edit",
  });
  return !!data;
}

// Get user's max role level
export async function getUserRoleLevel(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_user_role_level", { _user_id: userId });
  return data || 0;
}

// Get roles the current user can assign (only roles at or below their level)
export async function getAssignableRoles(userId: string) {
  const supabase = await createClient();
  const userLevel = await getUserRoleLevel(userId);

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, slug, is_system, level")
    .lte("level", userLevel)
    .order("level", { ascending: false });

  return roles || [];
}

// Get roles filtered: users with configuracoes.edit see all, others see non-system only
export async function getRolesForContext(userId: string) {
  const supabase = await createClient();
  const { data: canManageConfig } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _module: "configuracoes",
    _action: "edit",
  });

  if (canManageConfig) {
    const { data } = await supabase.from("roles").select("id, name, slug, is_system, level").order("level", { ascending: false });
    return data || [];
  }

  // Non-admin: only see non-system roles at or below their level
  const userLevel = await getUserRoleLevel(userId);
  const { data } = await supabase
    .from("roles")
    .select("id, name, slug, is_system, level")
    .eq("is_system", false)
    .lte("level", userLevel)
    .order("level", { ascending: false });

  return data || [];
}
