import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { getAuditLog } from "./actions";
import { AuditViewer } from "./audit-viewer";

export default async function AuditPage() {
  const p = await requirePermission("historico", "view");
  if (p.error) notFound();
  const { entries, total } = await getAuditLog({ limit: 20 });
  return <AuditViewer entries={entries} total={total} />;
}
