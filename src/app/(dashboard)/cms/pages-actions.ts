"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";

export async function getPages() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_pages")
    .select("*, page_collections:cms_page_collections(collection_id, role, collection:cms_collections(id, name, slug))")
    .order("sort_order");
  return data || [];
}

export async function createPage(formData: FormData) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const icon = formData.get("icon") as string || "file";
  const viewType = formData.get("viewType") as string || "table";
  const parentId = formData.get("parentId") as string;
  const isGroup = formData.get("isGroup") === "true";

  if (!title) return { error: "Título é obrigatório." };

  const { data: page, error } = await supabase.from("cms_pages").insert({
    title, slug: slug || undefined, icon, view_type: isGroup ? "table" : viewType,
    parent_id: parentId || null, is_group: isGroup,
  }).select().single();

  if (error) return { error: "Erro ao criar page." };

  // Link collections
  const collectionIds = formData.getAll("collectionIds") as string[];
  const collectionRoles = formData.getAll("collectionRoles") as string[];
  if (collectionIds.length > 0) {
    await supabase.from("cms_page_collections").insert(
      collectionIds.map((cid, i) => ({
        page_id: page.id,
        collection_id: cid,
        role: collectionRoles[i] || "main",
        sort_order: i,
      }))
    );
  }

  revalidatePath("/cms");
  return { success: true };
}

export async function updatePage(formData: FormData) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const icon = formData.get("icon") as string;
  const viewType = formData.get("viewType") as string;
  const parentId = formData.get("parentId") as string;
  const isGroup = formData.get("isGroup") === "true";

  if (!id || !title) return { error: "Dados inválidos." };

  await supabase.from("cms_pages").update({
    title, slug: slug || undefined, icon, view_type: isGroup ? "table" : viewType,
    parent_id: parentId || null, is_group: isGroup,
  }).eq("id", id);

  // Replace collection links
  await supabase.from("cms_page_collections").delete().eq("page_id", id);
  const collectionIds = formData.getAll("collectionIds") as string[];
  const collectionRoles = formData.getAll("collectionRoles") as string[];
  if (collectionIds.length > 0) {
    await supabase.from("cms_page_collections").insert(
      collectionIds.map((cid, i) => ({
        page_id: id,
        collection_id: cid,
        role: collectionRoles[i] || "main",
        sort_order: i,
      }))
    );
  }

  revalidatePath("/cms");
  return { success: true };
}

export async function deletePage(id: string) {
  const p = await requirePermission("cms", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("cms_pages").delete().eq("id", id);
  if (error) return { error: "Erro ao remover page." };
  revalidatePath("/cms");
  return { success: true };
}

export async function reorderPages(items: { id: string; sort_order: number; parent_id: string | null }[]) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();

  // Batch update sort_order and parent_id
  for (const item of items) {
    await supabase.from("cms_pages").update({
      sort_order: item.sort_order,
      parent_id: item.parent_id,
    }).eq("id", item.id);
  }

  revalidatePath("/cms");
  revalidatePath("/inicio");
  return { success: true };
}

export async function duplicatePage(id: string) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();

  const { data: page } = await supabase.from("cms_pages").select("*").eq("id", id).single();
  if (!page) return { error: "Página não encontrada." };

  const { data: newPage, error: pageErr } = await supabase.from("cms_pages").insert({
    title: `${page.title} (cópia)`,
    slug: `${page.slug}-copia`,
    icon: page.icon,
    view_type: page.view_type,
    parent_id: page.parent_id,
    is_group: page.is_group,
  }).select().single();

  if (pageErr || !newPage) return { error: "Erro ao duplicar página." };

  // Copy linked collections
  const { data: links } = await supabase
    .from("cms_page_collections")
    .select("*")
    .eq("page_id", id)
    .order("sort_order");

  if (links && links.length > 0) {
    await supabase.from("cms_page_collections").insert(
      links.map((lc) => ({
        page_id: newPage.id,
        collection_id: lc.collection_id,
        role: lc.role,
        sort_order: lc.sort_order,
      }))
    );
  }

  revalidatePath("/cms");
  return { success: true };
}
