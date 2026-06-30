"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission, getUserRoleLevel } from "@/lib/permissions";

// Ações pertinentes por módulo — só cria o que cada módulo realmente usa
const MODULE_ACTIONS: Record<string, string[]> = {
  dashboard:            ["view"],
  usuarios:             ["view", "create", "edit", "delete", "manage"],
  franquias:            ["view", "create", "edit", "delete"],
  cms:                  ["view", "create", "edit", "delete"],
  templates:            ["view", "create", "edit", "delete"],
  pedidos:              ["view", "view_all", "create", "edit", "approve", "export", "manage"],
  produtos:             ["view", "edit", "delete"],
  relatorios:           ["view", "export"],
  comunicados:          ["view", "create", "edit", "delete"],
  historico:            ["view"],
  faq:                  ["view", "create", "edit", "delete"],
  pesquisas:            ["view", "create", "edit", "delete"],
  leads:                ["view", "edit", "delete", "export"],
  biblioteca:           ["view", "download"],
  configuracoes:        ["view", "edit"],
};

// Páginas CMS dinâmicas usam essas ações
const CMS_PAGE_ACTIONS = ["view", "create", "edit", "download"];

const ALL_MODULES = Object.keys(MODULE_ACTIONS);

export async function getRoles() {
  await requireAuth();
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("*, role_permissions(permission_id)")
    .order("level", { ascending: false });
  return roles || [];
}

export async function getPermissions() {
  await requireAuth();
  const supabase = await createClient();

  // Ensure all module×action combinations exist
  await ensureAllPermissions();

  const { data } = await supabase
    .from("permissions")
    .select("*")
    .order("module")
    .order("action");
  return data || [];
}

async function ensureAllPermissions() {
  const supabase = await createClient();

  // Fetch CMS page slugs to include as dynamic modules
  const { data: cmsPages } = await supabase
    .from("cms_pages")
    .select("slug")
    .eq("page_type", "cms")
    .eq("is_group", false);

  const dynamicModules = (cmsPages || []).map((p) => p.slug);

  // Build full module→actions map (system modules + CMS pages)
  const moduleActions: Record<string, string[]> = { ...MODULE_ACTIONS };
  for (const slug of dynamicModules) {
    if (!moduleActions[slug]) {
      moduleActions[slug] = CMS_PAGE_ACTIONS;
    }
  }

  const { data: existing } = await supabase.from("permissions").select("module, action");
  const existingSet = new Set((existing || []).map((p) => `${p.module}::${p.action}`));

  const missing = Object.entries(moduleActions).flatMap(([module, actions]) =>
    actions.filter((action) => !existingSet.has(`${module}::${action}`))
      .map((action) => ({ module, action, description: `${module}.${action}` }))
  );

  if (missing.length > 0) {
    await supabase.from("permissions").insert(missing);
  }
}

function generateSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "_");
}

export async function createRole(formData: FormData) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const isSystem = formData.get("isSystem") === "true";
  const level = Number(formData.get("level") || "10");
  const permissionIds = formData.getAll("permissions") as string[];

  if (!name) return { error: "Nome é obrigatório." };

  const userLevel = await getUserRoleLevel(p.user!.id);
  if (level > userLevel) return { error: "Não é possível criar um tipo de acesso com nível superior ao seu." };

  const slug = generateSlug(name);

  const { data: role, error } = await supabase
    .from("roles")
    .insert({ name, slug, description, is_system: isSystem, level })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique")) return { error: "Já existe um tipo de acesso com esse nome." };
    return { error: error.message };
  }

  if (permissionIds.length > 0) {
    await supabase.from("role_permissions").insert(
      permissionIds.map((pid) => ({ role_id: role.id, permission_id: pid }))
    );
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function updateRole(formData: FormData) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const roleId = formData.get("roleId") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const isSystem = formData.get("isSystem") === "true";
  const level = Number(formData.get("level") || "10");
  const permissionIds = formData.getAll("permissions") as string[];

  if (!roleId || !name) return { error: "Dados inválidos." };

  const userLevel = await getUserRoleLevel(p.user!.id);
  if (level > userLevel) return { error: "Não é possível definir um nível superior ao seu." };

  // Prevent changing is_system on existing system roles
  const { data: existingRole } = await supabase.from("roles").select("is_system").eq("id", roleId).single();
  if (existingRole?.is_system && !isSystem) return { error: "Não é possível remover flag de sistema de roles do sistema." };

  const { error } = await supabase
    .from("roles")
    .update({ name, description, is_system: isSystem, level })
    .eq("id", roleId);

  if (error) return { error: error.message };

  // Replace all permissions
  await supabase.from("role_permissions").delete().eq("role_id", roleId);
  if (permissionIds.length > 0) {
    await supabase.from("role_permissions").insert(
      permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }))
    );
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function deleteRole(roleId: string) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();

  // Prevent deleting system roles
  const { data: role } = await supabase.from("roles").select("is_system").eq("id", roleId).single();
  if (role?.is_system) return { error: "Tipos de acesso do sistema não podem ser removidos." };

  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) return { error: "Erro ao remover. Verifique se não há usuários vinculados." };
  revalidatePath("/configuracoes");
  return { success: true };
}
