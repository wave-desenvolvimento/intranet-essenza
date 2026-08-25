import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BibliotecaContent } from "./biblioteca-content";
import { isAssetVisible } from "@/lib/utils";

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Permissoes + media fields em paralelo
  const [canViewRes, canDownloadRes, mediaFieldsRes] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: user.id, _module: "biblioteca", _action: "view" }),
    supabase.rpc("has_permission", { _user_id: user.id, _module: "biblioteca", _action: "download" }),
    supabase.from("cms_fields").select("id, slug, name, field_type, collection_id").in("field_type", ["image", "image_array", "image_variants", "file", "file_array", "video_array"]).order("sort_order"),
  ]);

  if (!canViewRes.data) redirect("/inicio");
  const canDownload = !!canDownloadRes.data;
  const mediaFields = mediaFieldsRes.data;

  if (!mediaFields || mediaFields.length === 0) {
    return <BibliotecaContent assets={[]} canDownload={canDownload} />;
  }

  const collectionIds = [...new Set(mediaFields.map((f) => f.collection_id))];
  const now = new Date().toISOString();

  // Collections, title fields, items, page links - tudo em paralelo
  const [collectionsRes, titleFieldsRes, itemsRes, pageLinksRes] = await Promise.all([
    supabase.from("cms_collections").select("id, name, slug").in("id", collectionIds),
    supabase.from("cms_fields").select("collection_id, slug").in("collection_id", collectionIds).eq("field_type", "text").order("sort_order"),
    supabase.from("cms_items").select("id, data, collection_id, created_at, published_at, expires_at, tags").in("collection_id", collectionIds).eq("status", "published").or(`expires_at.is.null,expires_at.gte.${now}`).or(`published_at.is.null,published_at.lte.${now}`).order("created_at", { ascending: false }).limit(500),
    supabase.from("cms_page_collections").select("collection_id, page:cms_pages(slug)").in("collection_id", collectionIds).eq("role", "main"),
  ]);

  const colMap = new Map((collectionsRes.data || []).map((c) => [c.id, c]));

  const titleFieldMap = new Map<string, string>();
  for (const tf of titleFieldsRes.data || []) {
    if (!titleFieldMap.has(tf.collection_id)) titleFieldMap.set(tf.collection_id, tf.slug);
  }

  const items = itemsRes.data;

  const pageLinks = pageLinksRes.data;

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
    type: "image" | "file" | "video";
    url: string;
    label: string;
    tags: string[];
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
    const itemTags = (item.tags as string[]) || [];

    for (const f of fields) {
      const raw = d[f.slug];
      if (!raw) continue;

      const isImageType = ["image", "image_array", "image_variants"].includes(f.field_type);

      if (f.field_type === "image" && typeof raw === "string" && raw) {
        assets.push({
          id: `${item.id}-${f.slug}`, itemId: item.id, title: itemTitle || f.name,
          collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
          type: "image", url: raw, label: f.name, tags: itemTags, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
        });
      } else if (f.field_type === "image_variants" && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [variant, url] of Object.entries(raw as Record<string, string>)) {
          if (!url) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${variant}`, itemId: item.id, title: itemTitle || variant,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: "image", url, label: variant, tags: itemTags, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
          });
        }
      } else if (f.field_type === "image_array" && Array.isArray(raw)) {
        for (const [i, img] of (raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]).entries()) {
          if (!img.url || !isAssetVisible(img)) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${i}`, itemId: item.id, title: itemTitle || img.title || `${f.name} ${i + 1}`,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: "image", url: img.url, label: img.title || `${f.name} ${i + 1}`, tags: itemTags, createdAt: item.created_at, publishedAt: img.published_at || item.published_at, expiresAt: img.expires_at || item.expires_at,
          });
        }
      } else if (f.field_type === "file" && typeof raw === "string" && raw) {
        assets.push({
          id: `${item.id}-${f.slug}`, itemId: item.id, title: itemTitle || f.name,
          collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
          type: "file", url: raw, label: f.name, tags: itemTags, createdAt: item.created_at, publishedAt: item.published_at, expiresAt: item.expires_at,
        });
      } else if (f.field_type === "file_array" && Array.isArray(raw)) {
        for (const [i, file] of (raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]).entries()) {
          if (!file.url || !isAssetVisible(file)) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${i}`, itemId: item.id, title: file.title || itemTitle || `${f.name} ${i + 1}`,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: isImageType ? "image" : "file", url: file.url, label: file.title || `${f.name} ${i + 1}`, tags: itemTags, createdAt: item.created_at, publishedAt: file.published_at || item.published_at, expiresAt: file.expires_at || item.expires_at,
          });
        }
      } else if (f.field_type === "video_array" && Array.isArray(raw)) {
        for (const [i, vid] of (raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]).entries()) {
          if (!vid.url || !isAssetVisible(vid)) continue;
          assets.push({
            id: `${item.id}-${f.slug}-${i}`, itemId: item.id, title: vid.title || itemTitle || `${f.name} ${i + 1}`,
            collection: col?.name || "", collectionSlug: col?.slug || "", pageSlug,
            type: "video", url: vid.url, label: vid.title || `${f.name} ${i + 1}`, tags: itemTags, createdAt: item.created_at, publishedAt: vid.published_at || item.published_at, expiresAt: vid.expires_at || item.expires_at,
          });
        }
      }
    }
  }

  return <BibliotecaContent assets={assets} canDownload={!!canDownload} />;
}
