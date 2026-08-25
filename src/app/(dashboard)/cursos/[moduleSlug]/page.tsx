import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/dev-mode-server";
import { CoursePlayerView } from "./course-player";

interface SidebarModule {
  id: string;
  title: string;
  slug: string;
  videos: { id: string; title: string; duration_seconds: number | null }[];
}

export default async function CourseModulePage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Permissoes + modulo + sidebar em paralelo
  const [permsRes, moduleRes, allModulesRes] = await Promise.all([
    supabase.rpc("get_user_permissions", { _user_id: user.id }),
    supabase.from("course_modules").select("*").eq("slug", moduleSlug).eq("status", "published").single(),
    supabase.from("course_modules").select("id, title, slug, course_videos(id, title, duration_seconds, sort_order, status)").eq("status", "published").order("sort_order"),
  ]);

  const realPermKeys = (permsRes.data || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);
  if (!effectivePerms.some((k) => k.startsWith("universo-da-marca."))) notFound();

  const currentModule = moduleRes.data;
  if (!currentModule) notFound();

  // Videos do modulo atual (depende do module.id)
  const { data: currentVideos } = await supabase
    .from("course_videos")
    .select("id, title, description, source_type, thumbnail_url, duration_seconds, sort_order, status")
    .eq("module_id", currentModule.id)
    .eq("status", "published")
    .order("sort_order");

  const allModules = allModulesRes.data;

  const sidebarModules: SidebarModule[] = (allModules || []).map((m) => ({
    id: m.id,
    title: m.title,
    slug: m.slug,
    videos: ((m.course_videos || []) as { id: string; title: string; duration_seconds: number | null; sort_order: number; status: string }[])
      .filter((v) => v.status === "published")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, title: v.title, duration_seconds: v.duration_seconds })),
  }));

  return (
    <CoursePlayerView
      module={currentModule}
      videos={currentVideos || []}
      sidebarModules={sidebarModules}
    />
  );
}
