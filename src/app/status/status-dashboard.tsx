"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, X, Send, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import type { Monitor, HealthCheck } from "./page";

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

function getGroupStatus(monitors: Monitor[]): "up" | "down" | "partial" | "unknown" {
  if (monitors.every((m) => m.current_status === "up")) return "up";
  if (monitors.every((m) => m.current_status === "down")) return "down";
  if (monitors.some((m) => m.current_status === "down")) return "partial";
  return "unknown";
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full shrink-0",
        status === "up" && "bg-emerald-500",
        status === "down" && "bg-red-500",
        status === "partial" && "bg-amber-400",
        (status === "unknown" || status === "empty") && "bg-ink-300",
      )}
    />
  );
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    up: { text: "Operational", color: "text-emerald-600" },
    down: { text: "Down", color: "text-red-500" },
    partial: { text: "Degraded", color: "text-amber-600" },
    unknown: { text: "Checking...", color: "text-ink-400" },
  };
  const label = labels[status] || labels.unknown;
  return <span className={cn("text-sm font-medium", label.color)}>{label.text}</span>;
}

function UptimeBar({ buckets }: { buckets: ReturnType<typeof getDayBuckets> }) {
  return (
    <div className="flex gap-[2px] mt-2">
      {buckets.map((bucket, i) => (
        <div
          key={i}
          title={`${bucket.date}: ${bucket.status === "up" ? "Operational" : bucket.status === "down" ? "Down" : bucket.status === "partial" ? "Degraded" : "No data"}`}
          className={cn(
            "flex-1 h-8 rounded-[2px] transition-colors hover:opacity-80",
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
  const allUnknown = monitors.every((m) => m.current_status === "unknown");

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

  if (allUnknown) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-50">
          <AlertTriangle size={28} className="text-ink-400" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">Verificando serviços...</h1>
        <p className="text-sm text-ink-500">O monitoramento ainda não coletou dados</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full",
        allUp && "bg-emerald-50",
        anyDown && !allUp && "bg-red-50",
        !allUp && !anyDown && "bg-amber-50",
      )}>
        {allUp && <CheckCircle2 size={28} className="text-emerald-500" />}
        {anyDown && <XCircle size={28} className="text-red-500" />}
        {!allUp && !anyDown && <AlertTriangle size={28} className="text-amber-500" />}
      </div>
      <h1 className="text-2xl font-semibold text-ink-900">
        {allUp ? "Todos os sistemas operacionais" : anyDown ? "Alguns sistemas com problemas" : "Sistemas parcialmente degradados"}
      </h1>
      <p className="text-sm text-ink-500">
        Atualizado em {dateStr} às {timeStr}
      </p>
    </div>
  );
}

function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      await fetch("/api/status-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          service: data.get("service"),
        }),
      });
      setSent(true);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink-900">Reportar problema</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-3">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-ink-900 mb-1">Relatório enviado</p>
            <p className="text-xs text-ink-500">Nossa equipe vai analisar o problema. Obrigado!</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-ink-200 transition-colors">
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-600">Nome</label>
                <input
                  name="name"
                  placeholder="Seu nome"
                  className="h-9 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-600">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="h-9 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-600">Serviço afetado</label>
              <select
                name="service"
                className="h-9 rounded-lg border border-ink-200 px-3 text-sm text-ink-700 focus:border-brand-olive focus:outline-none"
              >
                <option value="">Não sei / Geral</option>
                <option value="aplicacao">Aplicação</option>
                <option value="banco-de-dados">Banco de Dados</option>
                <option value="autenticacao">Autenticação</option>
                <option value="storage">Armazenamento</option>
                <option value="email">Email</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-600">Descreva o problema *</label>
              <textarea
                name="message"
                required
                rows={3}
                placeholder="O que está acontecendo?"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm resize-none focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-olive text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-60 transition-colors"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isPending ? "Enviando..." : "Enviar relatório"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function StatusDashboard({ monitors, checks }: Props) {
  const [reportOpen, setReportOpen] = useState(false);

  // Group monitors by group_name
  const groups = monitors.reduce<Record<string, Monitor[]>>((acc, mon) => {
    const group = mon.group_name || "Geral";
    if (!acc[group]) acc[group] = [];
    acc[group].push(mon);
    return acc;
  }, {});

  const groupOrder = Object.keys(groups);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <BrandLogo width={120} height={56} />
          <button
            onClick={() => setReportOpen(true)}
            className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
          >
            Reportar problema
          </button>
        </div>
      </header>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Overall status */}
        <div className="rounded-xl border border-ink-100 bg-white mb-8">
          <OverallStatus monitors={monitors} />
        </div>

        {/* Groups */}
        <div className="space-y-6">
          {groupOrder.map((groupName) => {
            const groupMonitors = groups[groupName];
            const groupStatus = getGroupStatus(groupMonitors);

            return (
              <div key={groupName} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-ink-50 bg-ink-25">
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={groupStatus} />
                    <h2 className="text-sm font-semibold text-ink-900">{groupName}</h2>
                  </div>
                  <StatusLabel status={groupStatus} />
                </div>

                {/* Monitors in group */}
                <div className="divide-y divide-ink-50">
                  {groupMonitors.map((monitor) => {
                    const uptime = getUptimePercent(monitor.id, checks);
                    const buckets = getDayBuckets(monitor.id, checks);
                    const hasHistory = checks.some((c) => c.monitor_id === monitor.id);

                    return (
                      <div key={monitor.id} className="px-6 py-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <StatusDot status={monitor.current_status} />
                            <div>
                              <span className="text-sm font-medium text-ink-900">{monitor.name}</span>
                              {monitor.description && (
                                <p className="text-xs text-ink-400 mt-0.5">{monitor.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {hasHistory && (
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
                            )}
                            <StatusLabel status={monitor.current_status} />
                          </div>
                        </div>

                        {hasHistory && (
                          <>
                            <UptimeBar buckets={buckets} />
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[11px] text-ink-400">90 dias atrás</span>
                              <span className="text-[11px] text-ink-400">Hoje</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <a
            href="https://www.wavecommerce.com.br/?utm_source=status-page&utm_medium=essenza&utm_campaign=powered-by"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-600 transition-colors"
          >
            Powered by WaveCommerce <ExternalLink size={10} />
          </a>
        </div>
      </main>
    </div>
  );
}
