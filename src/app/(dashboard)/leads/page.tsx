import { createClient } from "@/lib/supabase/server";
import { getLeads } from "./actions";
import { LeadsManager } from "./leads-manager";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const leads = await getLeads();

  const { data: canEdit } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "leads",
    _action: "edit",
  });

  const { data: canDelete } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "leads",
    _action: "delete",
  });

  const { data: canExport } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "leads",
    _action: "export",
  });

  return (
    <LeadsManager
      leads={leads}
      canEdit={!!canEdit}
      canDelete={!!canDelete}
      canExport={!!canExport}
    />
  );
}
