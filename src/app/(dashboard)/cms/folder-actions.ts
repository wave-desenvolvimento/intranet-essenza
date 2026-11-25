"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

// === Types ===

export interface Folder {
  id: string;
  name: string;
  icon: string;
  cover_url: string | null;
  page_id: string;
  parent_id: string | null;
  collection_id: string | null;
  view_type: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// === Queries ===

// === Mutations ===

export async function createFolder(formData: FormData) {
  const p = await requirePermission("cms", "create");
  if (p.error) return p;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const pageId = formData.get("pageId") as string;
  const name = formData.get("name") as string;
  const parentId = formData.get("parentId") as string;
  const collectionId = formData.get("collectionId") as string;
  const icon = (formData.get("icon") as string) || "folder";
  const viewType = formData.get("viewType") as string;
  const coverUrl = formData.get("coverUrl") as string;

  if (!pageId || !name) return { error: "Nome e página são obrigatórios." };

  // Get next sort_order
  const { count } = await supabase
    .from("cms_folders")
    .select("*", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq(parentId ? "parent_id" : "page_id", parentId || pageId);

  const { error } = await supabase.from("cms_folders").insert({
    name,
    icon,
    cover_url: coverUrl || null,
    page_id: pageId,
    parent_id: parentId || null,
    collection_id: collectionId || null,
    view_type: viewType || null,
    sort_order: count || 0,
    created_by: user?.id,
  });

  if (error) return { error: "Erro ao criar pasta." };

  revalidatePath("/pagina");
  return { success: true };
}

export async function updateFolder(formData: FormData) {
  const p = await requirePermission("cms", "edit");
  if (p.error) return p;

  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const icon = formData.get("icon") as string;
  const collectionId = formData.get("collectionId") as string;
  const viewType = formData.get("viewType") as string;
  const coverUrl = formData.get("coverUrl") as string;

  if (!id || !name) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("cms_folders")
    .update({
      name,
      icon: icon || "folder",
      cover_url: coverUrl || null,
      collection_id: collectionId || null,
      view_type: viewType || null,
    })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar pasta." };

  revalidatePath("/pagina");
  return { success: true };
}

export async function deleteFolder(id: string) {
  const p = await requirePermission("cms", "delete");
  if (p.error) return p;

  const supabase = await createClient();
  const { error } = await supabase.from("cms_folders").delete().eq("id", id);
  if (error) return { error: "Erro ao remover pasta." };

  revalidatePath("/pagina");
  return { success: true };
}

export async function moveFolder(id: string, newParentId: string | null) {
  const p = await requirePermission("cms", "edit");
  if (p.error) return p;

  // Prevent moving folder into itself or its children
  if (newParentId) {
    const supabase = await createClient();
    let checkId: string | null = newParentId;
    let depth = 0;
    while (checkId && depth < 20) {
      if (checkId === id) return { error: "Não é possível mover uma pasta para dentro de si mesma." };
      const { data } = await supabase
        .from("cms_folders")
        .select("parent_id")
        .eq("id", checkId)
        .single() as { data: { parent_id: string | null } | null };
      checkId = data?.parent_id || null;
      depth++;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cms_folders")
    .update({ parent_id: newParentId })
    .eq("id", id);

  if (error) return { error: "Erro ao mover pasta." };

  revalidatePath("/pagina");
  return { success: true };
}

export async function moveItemsToFolder(itemIds: string[], folderId: string | null) {
  const p = await requirePermission("cms", "edit");
  if (p.error) return p;

  const supabase = await createClient();
  const { error } = await supabase
    .from("cms_items")
    .update({ folder_id: folderId })
    .in("id", itemIds);

  if (error) return { error: "Erro ao mover itens." };

  revalidatePath("/pagina");
  return { success: true };
}

