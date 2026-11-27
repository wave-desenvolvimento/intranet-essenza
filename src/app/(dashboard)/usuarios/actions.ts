"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyUsers } from "@/lib/notify";
import { z } from "zod";
import { requirePermission, getRolesForContext, getUserRoleLevel, getUserScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const userSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]),
  franchiseId: z.union([z.literal(""), z.guid()]),
  isFranchiseAdmin: z.boolean(),
  status: z.enum(["active", "inactive"]),
  roleIds: z.array(z.guid()),
  externalId: z.number().nullable(),
  comissaoPercentual: z.number().min(0),
});

function parseUserForm(formData: FormData) {
  return userSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    franchiseId: formData.get("franchiseId") ?? "",
    isFranchiseAdmin: formData.get("isFranchiseAdmin") === "true",
    status: formData.get("status") || "active",
    roleIds: formData.getAll("roleIds"),
    externalId: Number(formData.get("externalId")) || null,
    comissaoPercentual: Number(formData.get("comissaoPercentual")) || 0,
  });
}

/** Bloqueia alvo fora do escopo, ou com nivel acima/igual. Retorna mensagem de erro ou null. */
async function checkTarget(callerId: string, targetId: string, action: "edit" | "delete"): Promise<string | null> {
  const supabase = await createClient();
  const [{ data: allowed }, callerScope, targetScope, callerLevel, targetLevel] = await Promise.all([
    supabase.rpc("can_manage_user", { _target: targetId, _action: action }),
    getUserScope(callerId),
    getUserScope(targetId),
    getUserRoleLevel(callerId),
    getUserRoleLevel(targetId),
  ]);
  if (!allowed) return "Usuário fora da sua franquia.";
  // A matriz gerencia qualquer franqueado, independente do nivel do perfil
  if (callerScope.isStaff && !targetScope.isStaff) return null;
  if (targetLevel >= callerLevel) return "Não é possível alterar usuário com nível igual ou superior.";
  return null;
}

export async function inviteUser(formData: FormData) {
  const p = await requirePermission("usuarios", "create"); if (p.error) return p;
  const parsed = parseUserForm(formData);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "email") return { error: "E-mail inválido. Confira se está completo e sem espaços." };
    if (field === "fullName") return { error: "Informe o nome completo." };
    return { error: "Dados inválidos." };
  }
  if (!parsed.data.email) return { error: "Informe o e-mail." };
  const { fullName, email, franchiseId, isFranchiseAdmin, roleIds, externalId, comissaoPercentual } = parsed.data;

  const [scope, assignable] = await Promise.all([getUserScope(p.user!.id), getRolesForContext(p.user!.id)]);
  if (!scope.isStaff && (!scope.franchiseId || franchiseId !== scope.franchiseId)) {
    return { error: "Você só pode criar usuários na sua franquia." };
  }
  if (roleIds.length === 0) return { error: "Selecione o tipo de acesso." };
  const assignableIds = new Set(assignable.map((r) => r.id));
  if (roleIds.some((id) => !assignableIds.has(id))) return { error: "Tipo de acesso não permitido." };

  const admin = createAdminClient();

  // Create user via Admin API with invite (user sets own password)
  const { data: userData, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/inicio`,
  });

  if (createError) {
    if (createError.message.includes("already")) return { error: "Este e-mail já está cadastrado." };
    return { error: "Erro ao criar usuário." };
  }

  const userId = userData.user.id;

  // Escopo e perfis ja validados acima; o RLS bloquearia um perfil que ainda nao tem franquia
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      franchise_id: franchiseId || null,
      is_franchise_admin: isFranchiseAdmin,
      ...(scope.isStaff && { external_id: externalId, comissao_percentual: comissaoPercentual }),
    })
    .eq("id", userId);
  const { error: rolesError } = await admin.from("user_roles").insert(
    roleIds.map((roleId) => ({ user_id: userId, role_id: roleId }))
  );
  if (profileError || rolesError) return { error: "Usuário convidado, mas houve erro ao salvar franquia ou acesso." };

  await logAudit({ action: "invite", entityType: "user", entityId: userId, description: `Convidou "${fullName}" (${email})` });

  // Create welcome notification for the new user
  notifyUsers({
    userIds: [userId],
    notification: {
      title: "Bem-vindo ao Hub Empório Essenza!",
      body: "Explore os conteúdos e materiais disponíveis para sua franquia",
      href: "/inicio",
      icon: "bell",
    },
  }).catch(() => {});

  revalidatePath("/usuarios");
  revalidatePath("/franquias/[slug]", "page");
  return { success: true };
}

export async function updateUser(formData: FormData) {
  const p = await requirePermission("usuarios", "edit"); if (p.error) return p;
  const userId = z.guid().safeParse(formData.get("userId"));
  const parsed = parseUserForm(formData);
  if (!userId.success || !parsed.success) return { error: "Dados inválidos." };
  const id = userId.data;
  const { fullName, email, franchiseId, isFranchiseAdmin, status, roleIds, externalId, comissaoPercentual } = parsed.data;

  const admin = createAdminClient();
  const [scope, assignable, callerLevel, currentRes] = await Promise.all([
    getUserScope(p.user!.id),
    getRolesForContext(p.user!.id),
    getUserRoleLevel(p.user!.id),
    admin.from("user_roles").select("role_id").eq("user_id", id),
  ]);
  if (currentRes.error) return { error: "Erro ao carregar o usuário." };

  const isSelf = id === p.user!.id;
  const isOwner = callerLevel >= 1000;
  const currentIds = new Set((currentRes.data || []).map((r) => r.role_id as string));
  const changed = [
    ...roleIds.filter((r) => !currentIds.has(r)),
    ...[...currentIds].filter((r) => !roleIds.includes(r)),
  ];

  if (!isOwner) {
    if (isSelf) {
      if (changed.length > 0) return { error: "Não é possível alterar suas próprias permissões." };
    } else {
      const denied = await checkTarget(p.user!.id, id, "edit");
      if (denied) return { error: denied };
    }
    const assignableIds = new Set(assignable.map((r) => r.id));
    if (changed.some((r) => !assignableIds.has(r))) return { error: "Tipo de acesso não permitido." };
    if (!scope.isStaff && franchiseId !== scope.franchiseId) return { error: "Não é possível trocar a franquia do usuário." };
  }

  // Update auth email if changed
  if (email) {
    const { error } = await admin.auth.admin.updateUserById(id, { email });
    if (error) return { error: "Erro ao atualizar o e-mail." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      ...(!(isSelf && !isOwner) && { franchise_id: franchiseId || null, is_franchise_admin: isFranchiseAdmin, status }),
      ...(scope.isStaff && { external_id: externalId, comissao_percentual: comissaoPercentual }),
    })
    .eq("id", id);
  if (profileError) return { error: "Erro ao salvar o usuário." };

  const added = changed.filter((r) => !currentIds.has(r));
  const removed = changed.filter((r) => currentIds.has(r));
  if (added.length > 0) {
    const { error } = await admin.from("user_roles").insert(added.map((roleId) => ({ user_id: id, role_id: roleId })));
    if (error) return { error: "Erro ao salvar o tipo de acesso." };
  }
  if (removed.length > 0) {
    const { error } = await admin.from("user_roles").delete().eq("user_id", id).in("role_id", removed);
    if (error) return { error: "Erro ao salvar o tipo de acesso." };
  }

  revalidatePath("/usuarios");
  revalidatePath("/franquias/[slug]", "page");
  return { success: true };
}

export async function toggleUserStatus(userId: string) {
  const p = await requirePermission("usuarios", "edit"); if (p.error) return p;
  const supabase = await createClient();

  // Prevent self-deactivation
  if (userId === p.user!.id) return { error: "Não é possível alterar seu próprio status." };

  const denied = await checkTarget(p.user!.id, userId, "edit");
  if (denied) return { error: denied };

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "Usuário não encontrado." };

  const newStatus = profile.status === "active" ? "inactive" : "active";
  await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);

  revalidatePath("/usuarios");
  revalidatePath("/franquias/[slug]", "page");
  return { success: true, status: newStatus };
}

export async function deleteUser(userId: string) {
  const p = await requirePermission("usuarios", "delete"); if (p.error) return p;

  // IDOR: não pode remover a si mesmo
  if (userId === p.user!.id) return { error: "Não é possível remover seu próprio usuário." };

  const denied = await checkTarget(p.user!.id, userId, "delete");
  if (denied) return { error: denied };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Erro ao remover usuário." };

  revalidatePath("/usuarios");
  return { success: true };
}
