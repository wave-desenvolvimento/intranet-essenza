import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BibliotecaContent } from "./biblioteca-content";

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check permission
  const { data: canView } = await supabase.rpc("has_permission", { _user_id: user.id, _module: "biblioteca", _action: "view" });
  if (!canView) redirect("/inicio");

  const { data: canDownload } = await supabase.rpc("has_permission", { _user_id: user.id, _module: "biblioteca", _action: "download" });

  // Get all collections that have media fields
  const mediaTypes = ["image", "image_array", "image_variants", "file", "file_array"];

  const { data: mediaFields } = await supabase
    .from("cms_fields")
    .select("id, slug, name, field_type, collection_id")
    .in("field_type", mediaTypes)
    .order("sort_order");

  if (!mediaFields || mediaFields.length === 0) {
    return <BibliotecaContent assets={[]} canDownload={!!canDownload} />;
  }

  const collectionIds = [...new Set(mediaFields.map((f) => f.collection_id))];

  // Get collections info
  const { data: collections } = await supabase
    .from("cms_collections")
    .select("id, name, slug")
    .in("id", collectionIds);

  const colMap = new Map((collections || []).map((c) => [c.id, c]));

  // Get all title fields for each collection
  const { data: titleFields } = await supabase
    .from("cms_fields")
    .select("collection_id, slug")
    .in("collection_id", collectionIds)
    .eq("field_type", "text")
    .order("sort_order");

  const titleFieldMap = new Map<string, string>();
  for (const tf of titleFields || []) {
    if (!titleFieldMap.has(tf.collection_id)) titleFieldMap.set(tf.collection_id, tf.slug);
  }

  // Get all published items from these collections
  const { data: items } = await supabase
    .from("cms_items")
    .select("id, data, collection_id, created_at, published_at, expires_at")
    .in("collection_id", collectionIds)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);

  // Get page slugs for collections
  const { data: pageLinks } = await supabase
    .from("cms_page_collections")
    .select("collection_id, page:cms_pages(slug)")
    .in("collection_id", collectionIds)
    .eq("role", "main");

  const pageMap = new Map((pageLinks || []).map((pl) => {
    const page = Array.isArray(pl.page) ? pl.page[0] : pl.page;
    return [pl.collection_id, page?.slug || ""];
  }));

  // Build flat list of assets
  interface Asset {
    id: string;
    itemId: string;
    title: string;
    collection: string;
    collectionSlug: string;
    pageSlug: string;
    type: "image" | "file";
    url: string;
    label: string;
    createdAt: string;
    publishedAt: string | null;
    expiresAt: string | null;
  }

  const assets: Asset[] = [];
  const fieldsPerCollection = new Map<string, typeof mediaFields>();
  for (const f of mediaFields) {
    const arr = fieldsPerCollection.get(f.collection_id) || [];
    arr.push(f);
    fieldsPerCollection.set(f.collection_id, arr);
  }

  for (const item of items || []) {
    const fields = fieldsPerCollection.get(item.collection_id) || [];
    const col = colMap.get(item.collection_id);
    const titleSlug = titleFieldMap.get(item.collection_id) || "titulo";
    const d = item.data as Record<string, unknown>;
    const itemTitle = String(d[titleSlug] || d.titulo || d.title || d.nome || "").trim();
    const pageSlug = pageMap.get(item.collection_id) || "";

    for (const f of fields) {
      const raw = d[f.slug];
      if (!raw) continue;

      const isImageType = ["image", "image_array", "image_variants"].includes(f.field_type);

      if (f.field_type === "image" && typeof raw === "string" && raw) {
        assets.push({
          id: `${item.id}-${f.slug}`, itemId: item.id, title: itemTitle || f.name,
          collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
          type: "image", url: raw, label: f.name, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
        });
      } else if (f.field_type === "image_variants" && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [variant, url] of Object.entries(raw as Record<string, string>)) {
          if (!url) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${variant}`, itemId: item.id, title: itemTitle || variant,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: "image", url, label: variant, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
          });
        }
      } else if (f.field_type === "image_array" && Array.isArray(raw)) {
        for (const [i, img] of (raw as { url: string; title?: string }[]).entries()) {
          if (!img.url) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${i}`, itemId: item.id, title: itemTitle || img.title || `${f.name} ${i + 1}`,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: "image", url: img.url, label: img.title || `${f.name} ${i + 1}`, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
          });
        }
      } else if (f.field_type === "file" && typeof raw === "string" && raw) {
        assets.push({
          id: `${item.id}-${f.slug}`, itemId: item.id, title: itemTitle || f.name,
          collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
          type: "file", url: raw, label: f.name, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
        });
      } else if (f.field_type === "file_array" && Array.isArray(raw)) {
        for (const [i, file] of (raw as { url: string; title?: string }[]).entries()) {
          if (!file.url) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${i}`, itemId: item.id, title: file.title || itemTitle || `${f.name} ${i + 1}`,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: isImageType ? "image" : "file", url: file.url, label: file.title || `${f.name} ${i + 1}`, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
          });
        }
      }
    }
  }

  return <BibliotecaContent assets={assets} canDownload={!!canDownload} />;
}
