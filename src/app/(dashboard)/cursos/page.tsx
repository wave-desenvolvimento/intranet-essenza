import { createClient } from "@/lib/supabase/server";
import { getModules, getPublishedModulesWithProgress } from "./course-actions";
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
  const canView = effectivePerms.some((k) => k.startsWith("universo-da-marca."));

  // Admin: ambas as views com toggle
  if (canEdit) {
    const [modules, publishedModules] = await Promise.all([
      getModules(),
      getPublishedModulesWithProgress(),
    ]);
    return (
      <CourseManagerWithToggle
        modules={modules}
        publishedModules={publishedModules}
        canEdit={canEdit}
        canView={canView}
      />
    );
  }

  // Franqueado: catalogo de cursos com progresso
  const modules = await getPublishedModulesWithProgress();
  return <CourseCatalog modules={modules} />;
}
