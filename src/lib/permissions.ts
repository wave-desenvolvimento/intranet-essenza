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

/** @deprecated RPC now uses auth.uid() internally - param is ignored */
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
// Owner bypasses via RPC returning max level
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

// Get roles filtered: configuracoes.edit sees franchise roles + system roles up to own level, others see non-system only
export async function getRolesForContext(userId: string) {
  const supabase = await createClient();
  const { data: canManageConfig } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _module: "configuracoes",
    _action: "edit",
  });

  if (canManageConfig) {
    const { data } = await supabase.from("roles").select("id, name, slug, is_system, level").order("level", { ascending: false });
    // Perfil de sistema so ate o proprio nivel: evita autopromocao a Owner
    const userLevel = await getUserRoleLevel(userId);
    return (data || []).filter((r) => !r.is_system || r.level <= userLevel);
  }

  // Matriz sem acesso a configuracoes atribui qualquer perfil de franquia; franqueado, ate o proprio nivel
  const { data: isStaff } = await supabase.rpc("is_network_staff", { _user_id: userId });
  let query = supabase.from("roles").select("id, name, slug, is_system, level").eq("is_system", false);
  if (!isStaff) query = query.lte("level", await getUserRoleLevel(userId));
  const { data } = await query.order("level", { ascending: false });

  return data || [];
}

/** Escopo do usuario logado: equipe da matriz alcanca a rede; franqueado, so a propria loja. */
export async function getUserScope(userId: string) {
  const supabase = await createClient();
  const [{ data: isStaff }, { data: profile }] = await Promise.all([
    supabase.rpc("is_network_staff", { _user_id: userId }),
    supabase.from("profiles").select("franchise_id").eq("id", userId).single(),
  ]);
  return { isStaff: !!isStaff, franchiseId: (profile?.franchise_id as string | null) ?? null };
}
