import { createClient } from "@/lib/supabase/server";
import { getLeads } from "./actions";
import { LeadsManager } from "./leads-manager";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Initial load: filter by "novo" (default)
  const result = await getLeads({ status: "novo" });

  const [canEditRes, canDeleteRes, canExportRes] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: user?.id || "", _module: "leads", _action: "edit" }),
    supabase.rpc("has_permission", { _user_id: user?.id || "", _module: "leads", _action: "delete" }),
    supabase.rpc("has_permission", { _user_id: user?.id || "", _module: "leads", _action: "export" }),
  ]);

  return (
    <LeadsManager
      initialData={result.data}
      initialTotal={result.total}
      initialCounts={result.counts}
      canEdit={!!canEditRes.data}
      canDelete={!!canDeleteRes.data}
      canExport={!!canExportRes.data}
    />
  );
}
