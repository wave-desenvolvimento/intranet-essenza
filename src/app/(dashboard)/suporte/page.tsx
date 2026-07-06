import { createClient } from "@/lib/supabase/server";
import { getTickets } from "./actions";
import { SupportManager } from "./support-manager";

export default async function SuportePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const result = await getTickets({ status: "novo" });

  const [canEditRes, canDeleteRes] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: user?.id || "", _module: "suporte", _action: "edit" }),
    supabase.rpc("has_permission", { _user_id: user?.id || "", _module: "suporte", _action: "delete" }),
  ]);

  return (
    <SupportManager
      initialData={result.data}
      initialTotal={result.total}
      initialCounts={result.counts}
      canEdit={!!canEditRes.data}
      canDelete={!!canDeleteRes.data}
    />
  );
}
