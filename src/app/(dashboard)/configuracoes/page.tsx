import { createClient } from "@/lib/supabase/server";
import { getRoles, getPermissions } from "./actions";
import { PermissionsManager } from "./permissions-manager";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [roles, permissions, { data: cmsPages }, { data: userRoles }] = await Promise.all([
    getRoles(),
    getPermissions(),
    supabase
      .from("cms_pages")
      .select("slug, title, icon")
      .eq("page_type", "cms")
      .eq("is_group", false)
      .order("sort_order"),
    supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", user!.id),
  ]);

  const pageModules = (cmsPages || []).map((p) => ({
    slug: p.slug,
    label: p.title,
    icon: p.icon,
  }));

  const currentUserRoleIds = (userRoles || []).map((ur) => ur.role_id);

  return <PermissionsManager roles={roles} permissions={permissions} pageModules={pageModules} currentUserRoleIds={currentUserRoleIds} />;
}
