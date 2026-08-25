import { createClient } from "@/lib/supabase/server";
import { AnnouncementsManager } from "./announcements-manager";

export default async function ComunicadosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const [announcementsRes, canCreateRes, franchisesRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("*, reads:announcement_reads(user_id)")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "comunicados", _action: "create" }),
    supabase.from("franchises").select("id, name, segment").eq("status", "active").order("name"),
  ]);

  const announcements = announcementsRes.data || [];

  // Enrich with author names
  if (announcements.length > 0) {
    const authorIds = [...new Set(announcements.map((a) => a.author_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
    for (const a of announcements) {
      (a as Record<string, unknown>).author = { full_name: profileMap.get(a.author_id) || "-" };
    }
  }

  return (
    <AnnouncementsManager
      announcements={announcements}
      franchises={franchisesRes.data || []}
      canManage={!!canCreateRes.data}
      currentUserId={userId}
    />
  );
}
