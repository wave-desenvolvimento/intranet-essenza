import { getAnalyticsDashboard, getOrdersAnalytics } from "../analytics-actions";
import { AnalyticsContent } from "./analytics-content";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const [data, ordersData] = await Promise.all([getAnalyticsDashboard(), getOrdersAnalytics()]);
  if ("error" in data) redirect("/inicio");
  if ("error" in ordersData) redirect("/inicio");
  return <AnalyticsContent data={data} ordersData={ordersData} />;
}
