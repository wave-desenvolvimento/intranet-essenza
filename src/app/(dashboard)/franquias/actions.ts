"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";

export async function getFranchises() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("franchises")
    .select("*, profiles(id, status)")
    .order("name");

  return (data || []).map((f) => ({
    ...f,
    totalUsers: f.profiles?.length || 0,
    activeUsers: f.profiles?.filter((p: { status: string }) => p.status === "active").length || 0,
    inactiveUsers: f.profiles?.filter((p: { status: string }) => p.status === "inactive").length || 0,
  }));
}

export async function getFranchise(id: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("franchises")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getFranchiseBySlug(slug: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("franchises")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function getFranchiseUsers(franchiseId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("franchise_id", franchiseId)
    .order("full_name");

  if (!profiles || profiles.length === 0) return [];

  // Buscar roles separadamente (PostgREST não infere o join profiles→user_roles)
  const userIds = profiles.map((p) => p.id);
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role_id, role:roles(id, name)")
    .in("user_id", userIds);

  return profiles.map((p) => ({
    ...p,
    user_roles: (userRoles || []).filter((ur) => ur.user_id === p.id),
  }));
}

function extractFranchiseFields(formData: FormData) {
  return {
    name: formData.get("name") as string,
    city: formData.get("city") as string,
    segment: formData.get("segment") as string || "franquia",
    phone: formData.get("phone") as string || null,
    whatsapp: formData.get("whatsapp") as string || null,
    email: formData.get("email") as string || null,
    instagram: formData.get("instagram") as string || null,
    facebook: formData.get("facebook") as string || null,
    tiktok: formData.get("tiktok") as string || null,
    website: formData.get("website") as string || null,
    logo_url: formData.get("logo_url") as string || null,
    address: formData.get("address") as string || null,
    neighborhood: formData.get("neighborhood") as string || null,
    state: formData.get("state") as string || null,
    cep: formData.get("cep") as string || null,
    cnpj: formData.get("cnpj") as string || null,
    opening_hours: formData.get("opening_hours") as string || null,
    manager_name: formData.get("manager_name") as string || null,
  };
}

export async function createFranchise(formData: FormData) {
  const p = await requirePermission("franquias", "create"); if (p.error) return p;
  const supabase = await createClient();
  const fields = extractFranchiseFields(formData);

  if (!fields.name) return { error: "Nome é obrigatório." };

  const { error } = await supabase.from("franchises").insert(fields);
  if (error) return { error: "Erro ao criar franquia." };

  revalidatePath("/franquias");
  return { success: true };
}

export async function updateFranchise(formData: FormData) {
  const p = await requirePermission("franquias", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const fields = extractFranchiseFields(formData);

  if (!id || !fields.name) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("franchises")
    .update({ ...fields, status })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar franquia." };

  revalidatePath("/franquias");
  return { success: true };
}

export async function deleteFranchise(id: string) {
  const p = await requirePermission("franquias", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("franchises").delete().eq("id", id);
  if (error) return { error: "Erro ao remover franquia. Verifique se não há usuários vinculados." };

  revalidatePath("/franquias");
  return { success: true };
}
