import { getAnalyticsDashboard, getOrdersAnalytics, getDetailedAnalytics } from "../analytics-actions";
import { AnalyticsContent } from "./analytics-content";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  // Checar permissao 1 vez antes de chamar as 3 actions
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/inicio");
  const { data: canView } = await supabase.rpc("has_permission", { _user_id: user.id, _module: "relatorios", _action: "view" });
  if (!canView) redirect("/inicio");

  try {
    const [data, ordersData, detailedData] = await Promise.all([
      getAnalyticsDashboard(),
      getOrdersAnalytics(),
      getDetailedAnalytics(),
    ]);
    if ("error" in data || "error" in ordersData || "error" in detailedData) redirect("/inicio");
    return <AnalyticsContent data={data} ordersData={ordersData} detailedData={detailedData} />;
  } catch {
    redirect("/inicio");
  }
}
