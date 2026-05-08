import { getMonitors } from "./actions";
import { MonitorsManager } from "./monitors-manager";

export default async function MonitorsPage() {
  const monitors = await getMonitors();
  return <MonitorsManager monitors={monitors} />;
}
