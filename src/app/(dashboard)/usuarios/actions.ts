"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyUsers } from "@/app/(dashboard)/notifications-actions";
import { requirePermission, getUserRoleLevel } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function getUsers() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, franchise:franchises(id, name, slug), user_roles(user_id, role_id, role:roles(id, name))")
    .order("created_at", { ascending: false });

  return (profiles || []).map((p) => ({
    ...p,
    user_roles: p.user_roles || [],
  }));
}

export async function getFranchises() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("franchises")
    .select("*")
    .eq("status", "active")
    .order("name");
  return data || [];
}

export async function getRoles() {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id, name").order("name");
  return data || [];
}

export async function inviteUser(formData: FormData) {
  const p = await requirePermission("usuarios", "create"); if (p.error) return p;
  const admin = createAdminClient();
  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const franchiseId = formData.get("franchiseId") as string;
  const isFranchiseAdmin = formData.get("isFranchiseAdmin") === "true";
  const roleIds = formData.getAll("roleIds") as string[];

  if (!fullName || !email) return { error: "Nome e e-mail são obrigatórios." };

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

  // Update profile with franchise info
  await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      franchise_id: franchiseId || null,
      is_franchise_admin: isFranchiseAdmin,
    })
    .eq("id", userId);

  // Assign roles
  if (roleIds.length > 0) {
    await supabase.from("user_roles").insert(
      roleIds.map((roleId) => ({ user_id: userId, role_id: roleId }))
    );
  }

  await logAudit({ action: "invite", entityType: "user", entityId: userId, description: `Convidou "${fullName}" (${email})` });

  // Create welcome notification for the new user
  notifyUsers([userId], {
    title: "Bem-vindo ao Hub Essenza!",
    body: "Explore os conteúdos e materiais disponíveis para sua franquia",
    href: "/inicio",
    icon: "bell",
  }).catch(() => {});

  revalidatePath("/usuarios");
  return { success: true };
}

export async function updateUser(formData: FormData) {
  const p = await requirePermission("usuarios", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const admin = createAdminClient();

  const userId = formData.get("userId") as string;
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const franchiseId = formData.get("franchiseId") as string;
  const isFranchiseAdmin = formData.get("isFranchiseAdmin") === "true";
  const status = formData.get("status") as string;
  const roleIds = formData.getAll("roleIds") as string[];

  if (!userId || !fullName) return { error: "Dados inválidos." };

  // Update auth email if changed
  if (email) {
    await admin.auth.admin.updateUserById(userId, { email });
  }

  // Update profile
  await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      franchise_id: franchiseId || null,
      is_franchise_admin: isFranchiseAdmin,
      status,
    })
    .eq("id", userId);

  // Replace roles
  await supabase.from("user_roles").delete().eq("user_id", userId);
  if (roleIds.length > 0) {
    await supabase.from("user_roles").insert(
      roleIds.map((roleId) => ({ user_id: userId, role_id: roleId }))
    );
  }

  revalidatePath("/usuarios");
  return { success: true };
}

export async function toggleUserStatus(userId: string) {
  const p = await requirePermission("usuarios", "edit"); if (p.error) return p;
  const supabase = await createClient();

  // IDOR: não pode alterar status de usuário com nível igual ou superior
  const [callerLevel, targetLevel] = await Promise.all([
    getUserRoleLevel(p.user!.id),
    getUserRoleLevel(userId),
  ]);
  if (targetLevel >= callerLevel) return { error: "Não é possível alterar status de usuário com nível igual ou superior." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "Usuário não encontrado." };

  const newStatus = profile.status === "active" ? "inactive" : "active";
  await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);

  revalidatePath("/usuarios");
  return { success: true, status: newStatus };
}

export async function deleteUser(userId: string) {
  const p = await requirePermission("usuarios", "delete"); if (p.error) return p;

  // IDOR: não pode remover a si mesmo
  if (userId === p.user!.id) return { error: "Não é possível remover seu próprio usuário." };

  // IDOR: não pode remover usuário com nível igual ou superior
  const [callerLevel, targetLevel] = await Promise.all([
    getUserRoleLevel(p.user!.id),
    getUserRoleLevel(userId),
  ]);
  if (targetLevel >= callerLevel) return { error: "Não é possível alterar status de usuário com nível igual ou superior." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Erro ao remover usuário." };

  revalidatePath("/usuarios");
  return { success: true };
}
