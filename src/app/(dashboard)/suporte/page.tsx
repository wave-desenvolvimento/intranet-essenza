import { createClient } from "@/lib/supabase/server";
import { type SupportTicket } from "./actions";
import { SupportManager } from "./support-manager";

export default async function SuportePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const [ticketsRes, countNovo, countEmAndamento, countResolvido, canEditRes, canDeleteRes] = await Promise.all([
    supabase.from("support_tickets").select("*", { count: "exact" }).eq("status", "novo").order("created_at", { ascending: false }).range(0, 29),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "em_andamento"),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "resolvido"),
    supabase.rpc("has_permission", { _user_id: userId, _module: "suporte", _action: "edit" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "suporte", _action: "delete" }),
  ]);

  return (
    <SupportManager
      initialData={(ticketsRes.data || []) as SupportTicket[]}
      initialTotal={ticketsRes.count || 0}
      initialCounts={{
        novo: countNovo.count || 0,
        em_andamento: countEmAndamento.count || 0,
        resolvido: countResolvido.count || 0,
      }}
      canEdit={!!canEditRes.data}
      canDelete={!!canDeleteRes.data}
    />
  );
}
