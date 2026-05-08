import { createClient } from "@supabase/supabase-js";
import { StatusDashboard } from "./status-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Status — Essenza Hub",
  description: "Status dos serviços do Essenza Hub em tempo real.",
};

interface HealthCheck {
  monitor_id: string;
  is_up: boolean;
  created_at: string;
}

interface Monitor {
  id: string;
  name: string;
  current_status: string;
  last_checked_at: string | null;
  sort_order: number;
}

export default async function StatusPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [{ data: monitors }, { data: checks }] = await Promise.all([
    supabase
      .from("monitors")
      .select("id, name, current_status, last_checked_at, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("health_checks")
      .select("monitor_id, is_up, created_at")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true }),
  ]);

  return (
    <StatusDashboard
      monitors={(monitors || []) as Monitor[]}
      checks={(checks || []) as HealthCheck[]}
    />
  );
}
