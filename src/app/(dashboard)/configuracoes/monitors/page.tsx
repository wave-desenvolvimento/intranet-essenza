import { requirePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { getMonitors } from "./actions";
import { MonitorsManager } from "./monitors-manager";

export default async function MonitorsPage() {
  const p = await requirePermission("configuracoes", "view");
  if (p.error) notFound();
  const monitors = await getMonitors();
  return <MonitorsManager monitors={monitors} />;
}
