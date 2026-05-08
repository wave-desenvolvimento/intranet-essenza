"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

export async function getTemplates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banner_templates")
    .select("*")
    .order("sort_order");
  return data || [];
}

export async function getPublishedTemplates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banner_templates")
    .select("*")
    .eq("status", "published")
    .order("sort_order");
  return data || [];
}

export async function createTemplate(formData: FormData) {
  const p = await requirePermission("templates", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const backgroundImage = formData.get("backgroundImage") as string;
  const backgroundColorStart = formData.get("backgroundColorStart") as string;
  const backgroundColorEnd = formData.get("backgroundColorEnd") as string;
  const aspectRatio = formData.get("aspectRatio") as string || "16/6";
  const overlays = formData.get("overlays") as string;
  const status = formData.get("status") as string || "draft";

  if (!title) return { error: "Título é obrigatório." };

  const { count } = await supabase
    .from("banner_templates")
    .select("*", { count: "exact", head: true });

  const { error } = await supabase.from("banner_templates").insert({
    title, description,
    background_image: backgroundImage || null,
    background_color_start: backgroundColorStart || null,
    background_color_end: backgroundColorEnd || null,
    aspect_ratio: aspectRatio,
    overlays: overlays ? (() => { try { return JSON.parse(overlays); } catch { return []; } })() : [],
    status,
    sort_order: count || 0,
    created_by: user?.id,
  });

  if (error) return { error: error.message || "Erro ao criar template." };
  revalidatePath("/templates");
  return { success: true };
}

export async function updateTemplate(formData: FormData) {
  const p = await requirePermission("templates", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const backgroundImage = formData.get("backgroundImage") as string;
  const backgroundColorStart = formData.get("backgroundColorStart") as string;
  const backgroundColorEnd = formData.get("backgroundColorEnd") as string;
  const aspectRatio = formData.get("aspectRatio") as string || "16/6";
  const overlays = formData.get("overlays") as string;
  const status = formData.get("status") as string;

  if (!id || !title) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("banner_templates")
    .update({
      title, description,
      background_image: backgroundImage || null,
      background_color_start: backgroundColorStart || null,
      background_color_end: backgroundColorEnd || null,
      aspect_ratio: aspectRatio,
      overlays: overlays ? (() => { try { return JSON.parse(overlays); } catch { return []; } })() : [],
      status,
    })
    .eq("id", id);

  if (error) return { error: error.message || "Erro ao atualizar template." };
  revalidatePath("/templates");
  return { success: true };
}

export async function deleteTemplate(id: string) {
  const p = await requirePermission("templates", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("banner_templates").delete().eq("id", id);
  if (error) return { error: "Erro ao remover template." };
  revalidatePath("/templates");
  return { success: true };
}
