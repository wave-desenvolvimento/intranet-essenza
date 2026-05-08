import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageRenderer } from "./page-renderer";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  // Fetch linked collections with their fields and items
  const { data: pageCollections } = await supabase
    .from("cms_page_collections")
    .select("role, collection_id, collection:cms_collections(id, name, slug)")
    .eq("page_id", page.id)
    .order("sort_order");

  const collections = await Promise.all(
    (pageCollections || []).map(async (pc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const col = pc.collection as any;
      const collection = Array.isArray(col) ? col[0] : col;
      if (!collection) return null;

      const [{ data: fields }, { data: items }] = await Promise.all([
        supabase.from("cms_fields").select("*").eq("collection_id", collection.id).order("sort_order"),
        supabase.from("cms_items").select("*").eq("collection_id", collection.id).eq("status", "published").order("sort_order"),
      ]);

      return {
        ...collection,
        role: pc.role,
        fields: fields || [],
        items: items || [],
      };
    })
  );

  const validCollections = collections.filter(Boolean);

  return (
    <PageRenderer
      page={page}
      collections={validCollections}
    />
  );
}
