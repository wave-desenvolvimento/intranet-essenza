import { createClient } from "@/lib/supabase/server";
import { getModules, getCourseCatalogData } from "./course-actions";
import { CourseManagerWithToggle } from "./course-manager-wrapper";
import { CourseCatalog } from "./course-catalog";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function CursosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perms } = await supabase.rpc("get_user_permissions", { _user_id: user?.id || "" });
  const realPermKeys = (perms || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);

  const canEdit = effectivePerms.includes("universo-da-marca.edit") || effectivePerms.includes("universo-da-marca.create");

  const catalogData = await getCourseCatalogData();
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Aluno";
  const userAvatar = user?.user_metadata?.avatar_url || "";

  // Admin: ambas as views com toggle
  if (canEdit) {
    const modules = await getModules();
    return (
      <CourseManagerWithToggle
        modules={modules}
        catalogData={catalogData}
        userName={userName}
        userAvatar={userAvatar}
        canEdit={canEdit}
        canView={true}
      />
    );
  }

  // Franqueado: catalogo de cursos com progresso
  return <CourseCatalog data={catalogData} userName={userName} userAvatar={userAvatar} />;
}
