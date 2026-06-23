import { createClient } from "@/lib/supabase/server";
import { getRoles, getPermissions } from "./actions";
import { PermissionsManager } from "./permissions-manager";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [roles, permissions, { data: cmsPages }] = await Promise.all([
    getRoles(),
    getPermissions(),
    supabase
      .from("cms_pages")
      .select("slug, title, icon")
      .eq("page_type", "cms")
      .eq("is_group", false)
      .order("sort_order"),
  ]);

  const pageModules = (cmsPages || []).map((p) => ({
    slug: p.slug,
    label: p.title,
    icon: p.icon,
  }));

  return <PermissionsManager roles={roles} permissions={permissions} pageModules={pageModules} />;
}
