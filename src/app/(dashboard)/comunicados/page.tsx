import { getAnnouncements } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementsManager } from "./announcements-manager";

export default async function ComunicadosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const announcements = await getAnnouncements();

  // Check if user can create
  const { data: canCreate } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "comunicados",
    _action: "create",
  });

  // Get franchises for target picker
  const { data: franchises } = await supabase
    .from("franchises")
    .select("id, name, segment")
    .eq("status", "active")
    .order("name");

  return (
    <AnnouncementsManager
      announcements={announcements}
      franchises={franchises || []}
      canManage={!!canCreate}
      currentUserId={user?.id || ""}
    />
  );
}
