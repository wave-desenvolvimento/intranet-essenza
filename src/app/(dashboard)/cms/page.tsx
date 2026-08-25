import { createClient } from "@/lib/supabase/server";
import { CmsShell } from "./cms-shell";

export default async function CmsPage() {
  const supabase = await createClient();

  const [collectionsRes, pagesRes, folderStyleRes] = await Promise.all([
    supabase
      .from("cms_collections")
      .select("*, fields:cms_fields(*), items:cms_items(*)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "cms_fields" })
      .order("sort_order", { referencedTable: "cms_items" }),
    supabase
      .from("cms_pages")
      .select("*, page_collections:cms_page_collections(collection_id, role, collection:cms_collections(id, name, slug))")
      .order("sort_order"),
    supabase.from("app_settings").select("value").eq("key", "folder_card_style").single(),
  ]);

  const collections = (collectionsRes.data || []).map((c) => ({
    ...c,
    fields: c.fields || [],
    items: c.items || [],
  }));

  const folderCardStyle = typeof folderStyleRes.data?.value === "string" ? folderStyleRes.data.value : "default";

  return <CmsShell collections={collections} pages={pagesRes.data || []} folderCardStyle={folderCardStyle} />;
}
