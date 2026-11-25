import { createClient } from "@/lib/supabase/server";
import { getModules, getCourseCatalogData } from "./course-actions";
import { CourseManagerWithToggle } from "./course-manager-wrapper";
import { coursePath } from "./course-path";
import { CourseCatalog } from "./course-catalog";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export async function CoursePage({ pageSlug, title }: { pageSlug: string; title: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Permissoes + catalogo em paralelo
  const [permsRes, catalogData] = await Promise.all([
    supabase.rpc("get_user_permissions", { _user_id: user?.id || "" }),
    getCourseCatalogData(pageSlug),
  ]);

  const realPermKeys = (permsRes.data || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);
  const canEdit = effectivePerms.includes(`${pageSlug}.edit`) || effectivePerms.includes(`${pageSlug}.create`);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Aluno";
  const userAvatar = user?.user_metadata?.avatar_url || "";

  if (canEdit) {
    const modules = await getModules(pageSlug);
    return (
      <CourseManagerWithToggle
        key={pageSlug}
        pageSlug={pageSlug}
        title={title}
        modules={modules}
        catalogData={catalogData}
        userName={userName}
        userAvatar={userAvatar}
        canEdit={canEdit}
        canView={true}
      />
    );
  }

  return <CourseCatalog basePath={coursePath(pageSlug)} data={catalogData} userName={userName} userAvatar={userAvatar} />;
}
