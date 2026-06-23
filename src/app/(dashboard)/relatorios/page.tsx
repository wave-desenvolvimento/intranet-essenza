import { getAnalyticsDashboard, getOrdersAnalytics, getDetailedAnalytics } from "../analytics-actions";
import { AnalyticsContent } from "./analytics-content";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const [data, ordersData, detailedData] = await Promise.all([
    getAnalyticsDashboard(),
    getOrdersAnalytics(),
    getDetailedAnalytics(),
  ]);
  if ("error" in data) redirect("/inicio");
  if ("error" in ordersData) redirect("/inicio");
  if ("error" in detailedData) redirect("/inicio");
  return <AnalyticsContent data={data} ordersData={ordersData} detailedData={detailedData} />;
}
