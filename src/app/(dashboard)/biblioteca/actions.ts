"use server";

import { createClient } from "@/lib/supabase/server";
import { isAssetVisible } from "@/lib/utils";

export interface LibraryAsset {
  id: string;
  url: string;
  title: string;
  collection: string;
  type: "image" | "file";
}

export async function getLibraryAssets(): Promise<LibraryAsset[]> {
  const supabase = await createClient();
  const mediaTypes = ["image", "image_array", "image_variants", "file", "file_array"];

  const { data: mediaFields } = await supabase
    .from("cms_fields")
    .select("id, slug, name, field_type, collection_id")
    .in("field_type", mediaTypes)
    .order("sort_order");

  if (!mediaFields || mediaFields.length === 0) return [];

  const collectionIds = [...new Set(mediaFields.map((f) => f.collection_id))];

  const [{ data: collections }, { data: titleFields }, { data: items }] = await Promise.all([
    supabase.from("cms_collections").select("id, name").in("id", collectionIds),
    supabase.from("cms_fields").select("collection_id, slug").in("collection_id", collectionIds).eq("field_type", "text").order("sort_order"),
    supabase.from("cms_items").select("id, data, collection_id").in("collection_id", collectionIds).eq("status", "published").or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(500),
  ]);

  const colMap = new Map((collections || []).map((c) => [c.id, c.name]));
  const titleFieldMap = new Map<string, string>();
  for (const tf of titleFields || []) {
    if (!titleFieldMap.has(tf.collection_id)) titleFieldMap.set(tf.collection_id, tf.slug);
  }

  const fieldsPerCol = new Map<string, typeof mediaFields>();
  for (const f of mediaFields) {
    const arr = fieldsPerCol.get(f.collection_id) || [];
    arr.push(f);
    fieldsPerCol.set(f.collection_id, arr);
  }

  const assets: LibraryAsset[] = [];

  for (const item of items || []) {
    const fields = fieldsPerCol.get(item.collection_id) || [];
    const d = item.data as Record<string, unknown>;
    const titleSlug = titleFieldMap.get(item.collection_id) || "titulo";
    const itemTitle = String(d[titleSlug] || d.titulo || d.title || d.nome || "").trim();
    const colName = colMap.get(item.collection_id) || "";

    for (const f of fields) {
      const raw = d[f.slug];
      if (!raw) continue;
      const isImageType = ["image", "image_array", "image_variants"].includes(f.field_type);

      if ((f.field_type === "image" || f.field_type === "file") && typeof raw === "string") {
        assets.push({ id: `${item.id}-${f.slug}`, url: raw, title: itemTitle || f.name, collection: colName, type: isImageType ? "image" : "file" });
      } else if (f.field_type === "image_variants" && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [variant, url] of Object.entries(raw as Record<string, string>)) {
          if (url) assets.push({ id: `${item.id}-${f.slug}-${variant}`, url, title: `${itemTitle || variant} - ${variant}`, collection: colName, type: "image" });
        }
      } else if (Array.isArray(raw)) {
        for (const [i, entry] of (raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]).entries()) {
          if (entry.url && isAssetVisible(entry)) assets.push({ id: `${item.id}-${f.slug}-${i}`, url: entry.url, title: entry.title || itemTitle || `${f.name} ${i + 1}`, collection: colName, type: isImageType ? "image" : "file" });
        }
      }
    }
  }

  return assets;
}
