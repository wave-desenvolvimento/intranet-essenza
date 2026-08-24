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

  // Permission check
  const { data: perms } = await supabase.rpc("get_user_permissions", { _user_id: user.id });
  const realPermKeys = (perms || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);
  const hasAccess = effectivePerms.some((k) => k.startsWith("universo-da-marca."));
  if (!hasAccess) notFound();

  // Fetch current module
  const { data: currentModule } = await supabase
    .from("course_modules")
    .select("*")
    .eq("slug", moduleSlug)
    .eq("status", "published")
    .single();

  if (!currentModule) notFound();

  // Fetch published videos for current module
  const { data: currentVideos } = await supabase
    .from("course_videos")
    .select("id, title, description, source_type, thumbnail_url, duration_seconds, sort_order, status")
    .eq("module_id", currentModule.id)
    .eq("status", "published")
    .order("sort_order");

  // Fetch ALL published modules with their videos for the sidebar
  const { data: allModules } = await supabase
    .from("course_modules")
    .select("id, title, slug, course_videos(id, title, duration_seconds, sort_order, status)")
    .eq("status", "published")
    .order("sort_order");

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
