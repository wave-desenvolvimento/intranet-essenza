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

/** Checks if user is system admin. Returns { error } if not. */
export async function requireSystemAdmin() {
  const { user, supabase } = await requireAuth();
  const { data: isAdmin } = await supabase.rpc("is_system_admin", { _user_id: user.id });
  if (!isAdmin) return { error: "Sem permissão", user: null, supabase: null };
  return { user, supabase, error: null };
}

// Check if user is system admin (level >= 80) via DB function
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_system_admin", { _user_id: userId });
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

// Get roles filtered: system admins see all, franchise admins see non-system only
export async function getRolesForContext(userId: string) {
  const supabase = await createClient();
  const isSysAdmin = await isSystemAdmin(userId);

  if (isSysAdmin) {
    const { data } = await supabase.from("roles").select("id, name, slug, is_system, level").order("level", { ascending: false });
    return data || [];
  }

  // Non-system admins: only see non-system roles at or below their level
  const userLevel = await getUserRoleLevel(userId);
  const { data } = await supabase
    .from("roles")
    .select("id, name, slug, is_system, level")
    .eq("is_system", false)
    .lte("level", userLevel)
    .order("level", { ascending: false });

  return data || [];
}
