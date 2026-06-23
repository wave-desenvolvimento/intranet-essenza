"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

// === Types ===

export interface Folder {
  id: string;
  name: string;
  icon: string;
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

export async function getFolders(pageId: string): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_folders")
    .select("*")
    .eq("page_id", pageId)
    .order("sort_order")
    .order("name");
  return (data || []) as Folder[];
}

export async function getFolder(id: string): Promise<Folder | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_folders")
    .select("*")
    .eq("id", id)
    .single();
  return data as Folder | null;
}

// Build breadcrumb path from folder to root
export async function getFolderBreadcrumb(folderId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const path: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;
  let depth = 0;

  while (currentId && depth < 20) {
    const { data } = await supabase
      .from("cms_folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single() as { data: { id: string; name: string; parent_id: string | null } | null };
    if (!data) break;
    path.unshift({ id: data.id, name: data.name });
    currentId = data.parent_id;
    depth++;
  }

  return path;
}

// Resolve effective collection_id (walk up tree, fallback to page main collection)
export async function resolveCollectionForFolder(
  folderId: string | null,
  pageId: string
): Promise<string | null> {
  const supabase = await createClient();

  // Walk up folder tree
  if (folderId) {
    let currentId: string | null = folderId;
    let depth = 0;
    while (currentId && depth < 20) {
      const { data } = await supabase
        .from("cms_folders")
        .select("collection_id, parent_id")
        .eq("id", currentId)
        .single() as { data: { collection_id: string | null; parent_id: string | null } | null };
      if (!data) break;
      if (data.collection_id) return data.collection_id;
      currentId = data.parent_id;
      depth++;
    }
  }

  // Fallback: page main collection
  const { data: pc } = await supabase
    .from("cms_page_collections")
    .select("collection_id")
    .eq("page_id", pageId)
    .eq("role", "main")
    .single();

  return pc?.collection_id || null;
}

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

  if (!id || !name) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("cms_folders")
    .update({
      name,
      icon: icon || "folder",
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

export async function moveItemToFolder(itemId: string, folderId: string | null) {
  const p = await requirePermission("cms", "edit");
  if (p.error) return p;

  const supabase = await createClient();
  const { error } = await supabase
    .from("cms_items")
    .update({ folder_id: folderId })
    .eq("id", itemId);

  if (error) return { error: "Erro ao mover item." };

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

export async function reorderFolders(orderedIds: string[]) {
  const p = await requirePermission("cms", "edit");
  if (p.error) return p;

  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("cms_folders").update({ sort_order: i }).eq("id", id)
    )
  );

  revalidatePath("/pagina");
  return { success: true };
}
