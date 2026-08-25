import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageRenderer } from "./page-renderer";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ folder?: string; item?: string }>;
}) {
  const { slug } = await params;
  const { folder: initialFolderId, item: initialItemId } = await searchParams;
  const supabase = await createClient();

  // Check permission for this page's module
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: perms } = await supabase.rpc("get_user_permissions", { _user_id: user.id });
    const realPermKeys = (perms || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
    const effectivePerms = await getEffectivePermissions(realPermKeys);
    const hasAccess = effectivePerms.some((k) => k.startsWith(`${slug}.`));
    if (!hasAccess) notFound();
  }

  // Fetch page
  const { data: page } = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!page || page.is_group) notFound();

  // Fetch linked collections with fields and items in a single query
  const { data: pageCollections } = await supabase
    .from("cms_page_collections")
    .select("role, collection:cms_collections(id, name, slug, fields:cms_fields(*), items:cms_items(*))")
    .eq("page_id", page.id)
    .order("sort_order")
    .order("sort_order", { referencedTable: "cms_collections.cms_fields" })
    .order("sort_order", { referencedTable: "cms_collections.cms_items" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validCollections = (pageCollections || []).map((pc: any) => {
    const col = Array.isArray(pc.collection) ? pc.collection[0] : pc.collection;
    if (!col) return null;
    return {
      ...col,
      role: pc.role,
      fields: col.fields || [],
      items: (col.items || []).filter((i: { status: string; published_at?: string | null; expires_at?: string | null }) => {
        if (i.status !== "published") return false;
        const now = new Date();
        if (i.published_at && new Date(i.published_at) > now) return false;
        if (i.expires_at && new Date(i.expires_at) < now) return false;
        return true;
      }),
    };
  }).filter(Boolean);

  // Course pages: strip video URLs from items to prevent client-side inspection
  if (page.view_type === "course") {
    for (const col of validCollections) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const urlField = (col as any).fields?.find((f: { field_type: string }) => f.field_type === "url");
      if (urlField) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of (col as any).items || []) {
          if (item.data?.[urlField.slug]) {
            item.data[urlField.slug] = "__protected__";
          }
        }
      }
    }
  }

  // Fetch folders, collections, folder style in parallel
  const [foldersRes, allCollectionsRes, folderStyleRes] = await Promise.all([
    supabase.from("cms_folders").select("*").eq("page_id", page.id).order("sort_order").order("name"),
    supabase.from("cms_collections").select("id, name, slug, icon").eq("is_group", false).order("name"),
    supabase.from("app_settings").select("value").eq("key", "folder_card_style").single(),
  ]);

  const folderCardStyle = typeof folderStyleRes.data?.value === "string" ? folderStyleRes.data.value : "default";

  return (
    <PageRenderer
      page={page}
      collections={validCollections}
      folders={foldersRes.data || []}
      allCollections={allCollectionsRes.data || []}
      initialFolderId={initialFolderId}
      initialItemId={initialItemId}
      folderCardStyle={folderCardStyle}
    />
  );
}
