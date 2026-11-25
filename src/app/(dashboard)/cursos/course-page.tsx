import { notFound } from "next/navigation";
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
  const [permsRes, catalogData, pageRes, certificateRes] = await Promise.all([
    supabase.rpc("get_user_permissions", { _user_id: user?.id || "" }),
    getCourseCatalogData(pageSlug),
    supabase.from("cms_pages").select("sequential, certificate").eq("slug", pageSlug).single(),
    supabase.from("course_certificates").select("id").eq("user_id", user?.id || "").eq("page_slug", pageSlug).maybeSingle(),
  ]);

  const realPermKeys = (permsRes.data || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);
  if (!effectivePerms.some((key) => key.startsWith(`${pageSlug}.`))) notFound();
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
        sequential={!!pageRes.data?.sequential}
        certificate={!!pageRes.data?.certificate}
        certificateId={certificateRes.data?.id ?? null}
        canConfigure={effectivePerms.includes("treinamentos.manage")}
      />
    );
  }

  return <CourseCatalog basePath={coursePath(pageSlug)} title={title} data={catalogData} userName={userName} userAvatar={userAvatar} hasCertificate={!!pageRes.data?.certificate} certificateId={certificateRes.data?.id ?? null} />;
}
