"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function getAnnouncements() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("*, reads:announcement_reads(user_id)")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  // Fetch author names separately (author_id → profiles.id)
  const authorIds = [...new Set(data.map((a) => a.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", authorIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

  return data.map((a) => ({
    ...a,
    author: { full_name: profileMap.get(a.author_id) || "—" },
  }));
}

export async function createAnnouncement(formData: FormData) {
  const p = await requirePermission("comunicados", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const priority = formData.get("priority") as string || "normal";
  const targetType = formData.get("targetType") as string || "all";
  const targetValue = formData.get("targetValue") as string || null;
  const expiresAt = formData.get("expiresAt") as string || null;
  const bannerUrl = formData.get("bannerUrl") as string || null;

  if (!title || !body) return { error: "Título e conteúdo são obrigatórios." };

  const { data: ann, error } = await supabase.from("announcements").insert({
    title, body, priority,
    target_type: targetType,
    target_value: targetValue || null,
    author_id: user.id,
    expires_at: expiresAt || null,
    banner_url: bannerUrl || null,
  }).select("id").single();

  if (error) return { error: "Erro ao criar comunicado." };

  await logAudit({
    action: "create",
    entityType: "announcement",
    entityId: ann.id,
    description: `Criou comunicado "${title}"`,
  });

  revalidatePath("/comunicados");
  revalidatePath("/inicio");
  return { success: true };
}

export async function updateAnnouncement(formData: FormData) {
  const p = await requirePermission("comunicados", "edit"); if (p.error) return p;
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const priority = formData.get("priority") as string;
  const targetType = formData.get("targetType") as string;
  const targetValue = formData.get("targetValue") as string || null;
  const expiresAt = formData.get("expiresAt") as string || null;
  const bannerUrl = formData.get("bannerUrl") as string || null;

  if (!id || !title || !body) return { error: "Dados inválidos." };

  const { error } = await supabase.from("announcements").update({
    title, body, priority,
    target_type: targetType,
    banner_url: bannerUrl || null,
    target_value: targetValue || null,
    expires_at: expiresAt || null,
  }).eq("id", id);

  if (error) return { error: "Erro ao atualizar comunicado." };

  await logAudit({
    action: "update",
    entityType: "announcement",
    entityId: id,
    description: `Editou comunicado "${title}"`,
  });

  revalidatePath("/comunicados");
  revalidatePath("/inicio");
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  const p = await requirePermission("comunicados", "delete"); if (p.error) return p;
  const supabase = await createClient();

  const { data: ann } = await supabase.from("announcements").select("title").eq("id", id).single();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: "Erro ao remover comunicado." };

  await logAudit({
    action: "delete",
    entityType: "announcement",
    entityId: id,
    description: `Removeu comunicado "${ann?.title || id}"`,
  });

  revalidatePath("/comunicados");
  revalidatePath("/inicio");
  return { success: true };
}

export async function markAsRead(announcementId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("announcement_reads").insert({
    announcement_id: announcementId,
    user_id: user.id,
  }).select().single(); // ON CONFLICT handled by PK
}
