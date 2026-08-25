import { createClient } from "@/lib/supabase/server";
import { type ResellerLead } from "./actions";
import { LeadsManager } from "./leads-manager";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  // Tudo em paralelo: leads filtrados, contagens por status, permissoes
  const [leadsRes, countNovo, countEmContato, countConvertido, countDescartado, canEditRes, canDeleteRes, canExportRes] = await Promise.all([
    supabase
      .from("reseller_leads")
      .select("*", { count: "exact" })
      .eq("status", "novo")
      .order("created_at", { ascending: false })
      .range(0, 29),
    supabase.from("reseller_leads").select("*", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("reseller_leads").select("*", { count: "exact", head: true }).eq("status", "em_contato"),
    supabase.from("reseller_leads").select("*", { count: "exact", head: true }).eq("status", "convertido"),
    supabase.from("reseller_leads").select("*", { count: "exact", head: true }).eq("status", "descartado"),
    supabase.rpc("has_permission", { _user_id: userId, _module: "leads", _action: "edit" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "leads", _action: "delete" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "leads", _action: "export" }),
  ]);

  return (
    <LeadsManager
      initialData={(leadsRes.data || []) as ResellerLead[]}
      initialTotal={leadsRes.count || 0}
      initialCounts={{
        novo: countNovo.count || 0,
        em_contato: countEmContato.count || 0,
        convertido: countConvertido.count || 0,
        descartado: countDescartado.count || 0,
      }}
      canEdit={!!canEditRes.data}
      canDelete={!!canDeleteRes.data}
      canExport={!!canExportRes.data}
    />
  );
}
