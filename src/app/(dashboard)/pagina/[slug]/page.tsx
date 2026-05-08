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
      items: (col.items || []).filter((i: { status: string }) => i.status === "published"),
    };
  }).filter(Boolean);

  return (
    <PageRenderer
      page={page}
      collections={validCollections}
    />
  );
}
