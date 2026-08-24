import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/dev-mode-server";
import { CoursePlayerView } from "./course-player";

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

  // Fetch module
  const { data: module } = await supabase
    .from("course_modules")
    .select("*")
    .eq("slug", moduleSlug)
    .eq("status", "published")
    .single();

  if (!module) notFound();

  // Fetch published videos (strip storage paths for security)
  const { data: videos } = await supabase
    .from("course_videos")
    .select("id, title, description, source_type, thumbnail_url, duration_seconds, sort_order, status")
    .eq("module_id", module.id)
    .eq("status", "published")
    .order("sort_order");

  return (
    <CoursePlayerView
      module={module}
      videos={videos || []}
    />
  );
}
