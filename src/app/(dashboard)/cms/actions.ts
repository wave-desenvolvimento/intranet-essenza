"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

function safeJsonParse(str: string, fallback: unknown = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// === Collections ===

export async function getCollections() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_collections")
    .select("*, fields:cms_fields(id), items:cms_items(id)")
    .order("sort_order");

  return (data || []).map((c) => ({
    ...c,
    fieldCount: c.fields?.length || 0,
    itemCount: c.items?.length || 0,
  }));
}

export async function getCollectionsFull() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_collections")
    .select("*")
    .order("sort_order");

  if (!data) return [];

  const result = await Promise.all(
    data.map(async (c) => {
      const [{ data: fields }, { data: items }] = await Promise.all([
        supabase.from("cms_fields").select("*").eq("collection_id", c.id).order("sort_order"),
        supabase.from("cms_items").select("*").eq("collection_id", c.id).order("sort_order"),
      ]);
      return { ...c, fields: fields || [], items: items || [] };
    })
  );

  return result;
}

export async function getCollection(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_collections")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

export async function createCollection(formData: FormData) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const icon = formData.get("icon") as string || "folder";
  const parentId = formData.get("parentId") as string;
  const isGroup = formData.get("isGroup") === "true";
  const viewType = formData.get("viewType") as string || "table";

  if (!name) return { error: "Nome é obrigatório." };

  const { error } = await supabase.from("cms_collections").insert({
    name, description, icon,
    parent_id: parentId || null,
    is_group: isGroup,
    view_type: isGroup ? "table" : viewType,
  });
  if (error) return { error: "Erro ao criar collection." };

  revalidatePath("/cms");
  return { success: true };
}

export async function updateCollection(formData: FormData) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const icon = formData.get("icon") as string;
  const parentId = formData.get("parentId") as string;
  const isGroup = formData.get("isGroup") === "true";

  if (!id || !name) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("cms_collections")
    .update({ name, description, icon, parent_id: parentId || null, is_group: isGroup, view_type: isGroup ? "table" : (formData.get("viewType") as string || "table") })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar collection." };

  revalidatePath("/cms");
  return { success: true };
}

export async function deleteCollection(id: string) {
  const p = await requirePermission("cms", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("cms_collections").delete().eq("id", id);
  if (error) return { error: "Erro ao remover. Verifique se não há itens vinculados." };

  revalidatePath("/cms");
  return { success: true };
}

// === Fields ===

export async function getFields(collectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_fields")
    .select("*")
    .eq("collection_id", collectionId)
    .order("sort_order");
  return data || [];
}

export async function createField(formData: FormData) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();
  const collectionId = formData.get("collectionId") as string;
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const fieldType = formData.get("fieldType") as string;
  const required = formData.get("required") === "true";
  const placeholder = formData.get("placeholder") as string;
  const optionsRaw = formData.get("options") as string;

  if (!collectionId || !name || !slug || !fieldType) return { error: "Dados incompletos." };

  const options = optionsRaw ? safeJsonParse(optionsRaw) : null;

  // Get next sort order
  const { count } = await supabase
    .from("cms_fields")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  const { error } = await supabase.from("cms_fields").insert({
    collection_id: collectionId,
    name,
    slug,
    field_type: fieldType,
    required,
    placeholder,
    options,
    sort_order: count || 0,
  });

  if (error) {
    if (error.message.includes("unique")) return { error: "Já existe um campo com esse slug." };
    return { error: "Erro ao criar campo." };
  }

  revalidatePath("/cms");
  return { success: true };
}

export async function updateField(formData: FormData) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const fieldType = formData.get("fieldType") as string;
  const required = formData.get("required") === "true";
  const placeholder = formData.get("placeholder") as string;
  const optionsRaw = formData.get("options") as string;

  if (!id || !name) return { error: "Dados inválidos." };

  const options = optionsRaw ? safeJsonParse(optionsRaw) : null;

  const { error } = await supabase
    .from("cms_fields")
    .update({ name, field_type: fieldType, required, placeholder, options })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar campo." };

  revalidatePath("/cms");
  return { success: true };
}

export async function deleteField(id: string) {
  const p = await requirePermission("cms", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("cms_fields").delete().eq("id", id);
  if (error) return { error: "Erro ao remover campo." };

  revalidatePath("/cms");
  return { success: true };
}

// === Items ===

export async function getItems(collectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_items")
    .select("*")
    .eq("collection_id", collectionId)
    .order("sort_order");
  return data || [];
}

export async function createItem(formData: FormData) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const collectionId = formData.get("collectionId") as string;
  const dataRaw = formData.get("data") as string;
  const status = formData.get("status") as string || "draft";
  const publishedAt = formData.get("publishedAt") as string;
  const expiresAt = formData.get("expiresAt") as string;

  if (!collectionId || !dataRaw) return { error: "Dados incompletos." };

  const { count } = await supabase
    .from("cms_items")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  const { error } = await supabase.from("cms_items").insert({
    collection_id: collectionId,
    data: safeJsonParse(dataRaw, {}),
    status,
    sort_order: count || 0,
    created_by: user?.id,
    published_at: publishedAt || null,
    expires_at: expiresAt || null,
  });

  if (error) return { error: "Erro ao criar item." };

  revalidatePath("/cms");
  return { success: true };
}

export async function updateItem(formData: FormData) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const dataRaw = formData.get("data") as string;
  const status = formData.get("status") as string;
  const publishedAt = formData.get("publishedAt") as string;
  const expiresAt = formData.get("expiresAt") as string;

  if (!id || !dataRaw) return { error: "Dados inválidos." };

  const { error } = await supabase
    .from("cms_items")
    .update({
      data: safeJsonParse(dataRaw, {}),
      status,
      published_at: publishedAt || null,
      expires_at: expiresAt || null,
    })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar item." };

  revalidatePath("/cms");
  return { success: true };
}

export async function deleteItem(id: string) {
  const p = await requirePermission("cms", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("cms_items").delete().eq("id", id);
  if (error) return { error: "Erro ao remover item." };

  revalidatePath("/cms");
  return { success: true };
}

// === Reorder ===

export async function reorderItems(orderedIds: string[]) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("cms_items").update({ sort_order: i }).eq("id", id)
    )
  );
  revalidatePath("/cms");
  return { success: true };
}

export async function reorderFields(orderedIds: string[]) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("cms_fields").update({ sort_order: i }).eq("id", id)
    )
  );
  revalidatePath("/cms");
  return { success: true };
}

export async function bulkUpdateStatus(ids: string[], status: string) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  if (!["draft", "published", "archived"].includes(status)) return { error: "Status invalido" };
  const supabase = await createClient();
  const { error } = await supabase.from("cms_items").update({ status }).in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/cms");
  return { success: true };
}

export async function bulkDeleteItems(ids: string[]) {
  const p = await requirePermission("cms", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("cms_items").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/cms");
  return { success: true };
}

// === Duplicate ===

export async function duplicateItem(id: string) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: item } = await supabase.from("cms_items").select("*").eq("id", id).single();
  if (!item) return { error: "Item não encontrado." };

  // Get next sort_order
  const { count } = await supabase
    .from("cms_items")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", item.collection_id);

  const { error } = await supabase.from("cms_items").insert({
    collection_id: item.collection_id,
    data: item.data,
    status: "draft",
    sort_order: count || 0,
    created_by: user?.id,
    published_at: null,
    expires_at: null,
  });

  if (error) return { error: "Erro ao duplicar item." };
  revalidatePath("/cms");
  return { success: true };
}

export async function duplicateCollection(id: string) {
  const p = await requirePermission("cms", "create"); if (p.error) return p;
  const supabase = await createClient();

  // Fetch original collection
  const { data: col } = await supabase.from("cms_collections").select("*").eq("id", id).single();
  if (!col) return { error: "Collection não encontrada." };

  // Generate unique slug
  const newSlug = `${col.slug}-copia`;

  // Create new collection
  const { data: newCol, error: colErr } = await supabase.from("cms_collections").insert({
    name: `${col.name} (cópia)`,
    slug: newSlug,
    description: col.description,
    icon: col.icon,
    parent_id: col.parent_id,
    is_group: col.is_group,
    view_type: col.view_type,
  }).select().single();

  if (colErr || !newCol) return { error: "Erro ao duplicar collection." };

  // Copy fields
  const { data: fields } = await supabase.from("cms_fields").select("*").eq("collection_id", id).order("sort_order");
  if (fields && fields.length > 0) {
    await supabase.from("cms_fields").insert(
      fields.map((f) => ({
        collection_id: newCol.id,
        name: f.name,
        slug: f.slug,
        field_type: f.field_type,
        required: f.required,
        placeholder: f.placeholder,
        options: f.options,
        sort_order: f.sort_order,
      }))
    );
  }

  // Copy items
  const { data: items } = await supabase.from("cms_items").select("*").eq("collection_id", id).order("sort_order");
  if (items && items.length > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("cms_items").insert(
      items.map((item) => ({
        collection_id: newCol.id,
        data: item.data,
        status: "draft",
        sort_order: item.sort_order,
        created_by: user?.id,
      }))
    );
  }

  revalidatePath("/cms");
  return { success: true };
}
