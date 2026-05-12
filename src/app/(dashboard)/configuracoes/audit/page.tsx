import { getAuditLog } from "./actions";
import { AuditViewer } from "./audit-viewer";

export default async function AuditPage() {
  const { entries, total } = await getAuditLog({ limit: 20 });
  return <AuditViewer entries={entries} total={total} />;
}
