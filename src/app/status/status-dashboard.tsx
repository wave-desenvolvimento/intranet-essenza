"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

interface Monitor {
  id: string;
  name: string;
  current_status: string;
  last_checked_at: string | null;
  sort_order: number;
}

interface HealthCheck {
  monitor_id: string;
  is_up: boolean;
  created_at: string;
}

interface Props {
  monitors: Monitor[];
  checks: HealthCheck[];
}

function getUptimePercent(monitorId: string, checks: HealthCheck[]): number {
  const monitorChecks = checks.filter((c) => c.monitor_id === monitorId);
  if (monitorChecks.length === 0) return 100;
  const upCount = monitorChecks.filter((c) => c.is_up).length;
  return Math.round((upCount / monitorChecks.length) * 10000) / 100;
}

function getDayBuckets(monitorId: string, checks: HealthCheck[]): { date: string; status: "up" | "down" | "partial" | "empty" }[] {
  const monitorChecks = checks.filter((c) => c.monitor_id === monitorId);
  const buckets: { date: string; status: "up" | "down" | "partial" | "empty" }[] = [];

  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayChecks = monitorChecks.filter((c) => c.created_at.startsWith(dateStr));

    if (dayChecks.length === 0) {
      buckets.push({ date: dateStr, status: "empty" });
    } else {
      const allUp = dayChecks.every((c) => c.is_up);
      const allDown = dayChecks.every((c) => !c.is_up);
      if (allUp) buckets.push({ date: dateStr, status: "up" });
      else if (allDown) buckets.push({ date: dateStr, status: "down" });
      else buckets.push({ date: dateStr, status: "partial" });
    }
  }

  return buckets;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "up") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <CheckCircle2 size={16} />
        Operational
      </span>
    );
  }
  if (status === "down") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
        <XCircle size={16} />
        Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-400">
      <AlertTriangle size={16} />
      Unknown
    </span>
  );
}

function UptimeBar({ buckets }: { buckets: ReturnType<typeof getDayBuckets> }) {
  return (
    <div className="flex gap-[2px] mt-2">
      {buckets.map((bucket, i) => (
        <div
          key={i}
          title={`${bucket.date}: ${bucket.status}`}
          className={cn(
            "flex-1 h-8 rounded-[2px] transition-colors",
            bucket.status === "up" && "bg-emerald-500",
            bucket.status === "down" && "bg-red-500",
            bucket.status === "partial" && "bg-amber-400",
            bucket.status === "empty" && "bg-ink-100",
          )}
        />
      ))}
    </div>
  );
}

function OverallStatus({ monitors }: { monitors: Monitor[] }) {
  const allUp = monitors.every((m) => m.current_status === "up");
  const anyDown = monitors.some((m) => m.current_status === "down");

  if (allUp) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">All systems operational</h1>
        <p className="text-sm text-ink-500">
          Last updated on {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" })}
        </p>
      </div>
    );
  }

  if (anyDown) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <XCircle size={28} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">Some systems are experiencing issues</h1>
        <p className="text-sm text-ink-500">
          Last updated on {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-50">
        <AlertTriangle size={28} className="text-ink-400" />
      </div>
      <h1 className="text-2xl font-semibold text-ink-900">Checking systems...</h1>
      <p className="text-sm text-ink-500">Monitoring has not started yet</p>
    </div>
  );
}

export function StatusDashboard({ monitors, checks }: Props) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <BrandLogo width={120} height={56} />
          <div className="flex items-center gap-4">
            <a
              href="mailto:suporte@emporioessenza.com.br"
              className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
            >
              Report an issue
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Overall status */}
        <div className="rounded-xl border border-ink-100 bg-white mb-8">
          <OverallStatus monitors={monitors} />
        </div>

        {/* Monitors */}
        <div className="rounded-xl border border-ink-100 bg-white divide-y divide-ink-50">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-sm font-medium text-ink-700">Current status by service</h2>
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-500">
              {monitors.every((m) => m.current_status === "up") ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Operational
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-amber-500" />
                  Degraded
                </>
              )}
            </span>
          </div>

          {monitors.map((monitor) => {
            const uptime = getUptimePercent(monitor.id, checks);
            const buckets = getDayBuckets(monitor.id, checks);

            return (
              <div key={monitor.id} className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        monitor.current_status === "up" && "bg-emerald-500",
                        monitor.current_status === "down" && "bg-red-500",
                        monitor.current_status === "unknown" && "bg-ink-300",
                      )}
                    />
                    <span className="text-sm font-medium text-ink-900">{monitor.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        uptime >= 99.5 && "text-emerald-600",
                        uptime >= 95 && uptime < 99.5 && "text-amber-600",
                        uptime < 95 && "text-red-500",
                      )}
                    >
                      {uptime}% uptime
                    </span>
                    <StatusBadge status={monitor.current_status} />
                  </div>
                </div>

                <UptimeBar buckets={buckets} />

                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-ink-400">90 days ago</span>
                  <span className="text-[11px] text-ink-400">Today</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="/login"
            className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-600 transition-colors"
          >
            Powered by Essenza Hub <ExternalLink size={10} />
          </a>
        </div>
      </main>
    </div>
  );
}
