"use client";

import { useState, useCallback, useTransition, Fragment } from "react";
import {
  BarChart3, Eye, Download, Users, Building2, TrendingUp,
  ShoppingCart, DollarSign, Package, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, Check, CalendarDays, Loader2, Activity,
  ChevronDown, ChevronRight, Clock, MousePointerClick, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { getAnalyticsDashboard, getOrdersAnalytics, getDetailedAnalytics } from "../analytics-actions";

interface TopItem {
  itemId: string;
  title: string;
  collection: string;
  count: number;
}

interface FranchiseStats {
  franchiseId: string;
  name: string;
  views: number;
  downloads: number;
}

interface OrdersFranchise {
  franchiseId: string;
  name: string;
  segment: string;
  orders: number;
  revenue: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface OrdersData {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  prevRevenue: number;
  prevOrders: number;
  byStatus: Record<string, { count: number; revenue: number }>;
  byFranchise: OrdersFranchise[];
  topProducts: TopProduct[];
}

interface ModuleUsageItem {
  module: string;
  label: string;
  views: number;
  uniqueUsers: number;
  uniqueFranchises: number;
}

interface FranchiseUser {
  name: string;
  pageViews: number;
  lastSeen: string;
}

interface FranchiseModuleItem {
  module: string;
  label: string;
  count: number;
}

interface FranchiseDetail {
  franchiseId: string;
  name: string;
  totalPageViews: number;
  contentViews: number;
  contentDownloads: number;
  activeUsers: number;
  lastActivity: string | null;
  modules: FranchiseModuleItem[];
  users: FranchiseUser[];
}

interface ActivityLogEntry {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  description: string;
  franchiseName: string | null;
  createdAt: string;
}

interface DetailedData {
  totalPageViews: number;
  totalSessions: number;
  moduleUsage: ModuleUsageItem[];
  franchiseDetails: FranchiseDetail[];
  activityLog: ActivityLogEntry[];
}

interface Props {
  data: {
    totals: { views: number; downloads: number; activeUsers: number };
    topViewed: TopItem[];
    topDownloaded: TopItem[];
    byFranchise: FranchiseStats[];
  };
  ordersData: OrdersData;
  detailedData: DetailedData;
}

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "text-warning", bg: "bg-warning-soft" },
  aprovado: { label: "Aprovado", color: "text-info", bg: "bg-info-soft" },
  confirmado: { label: "Confirmado", color: "text-success", bg: "bg-success-soft" },
  separacao: { label: "Em Separação", color: "text-warning", bg: "bg-warning-soft" },
  faturado: { label: "Faturado", color: "text-brand-olive", bg: "bg-brand-olive-soft" },
  entregue: { label: "Entregue", color: "text-brand-olive", bg: "bg-brand-olive-soft" },
  cancelado: { label: "Cancelado", color: "text-danger", bg: "bg-danger-soft" },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Criou", color: "text-success" },
  update: { label: "Editou", color: "text-info" },
  delete: { label: "Excluiu", color: "text-danger" },
  approve: { label: "Aprovou", color: "text-brand-olive" },
  invite: { label: "Convidou", color: "text-info" },
  login: { label: "Login", color: "text-ink-500" },
};

const EXPORT_SECTIONS = [
  { key: "resumo", label: "Resumo geral" },
  { key: "mais-visualizados", label: "Conteúdo — Mais visualizados" },
  { key: "mais-baixados", label: "Conteúdo — Mais baixados" },
  { key: "modulos", label: "Uso por módulo" },
  { key: "pedidos-status", label: "Pedidos — Por status" },
  { key: "pedidos-produtos", label: "Pedidos — Top produtos" },
  { key: "pedidos-franquias", label: "Pedidos — Por franquia" },
  { key: "engajamento", label: "Franquias — Engajamento detalhado" },
  { key: "atividade", label: "Log de atividade" },
] as const;

type ExportKey = (typeof EXPORT_SECTIONS)[number]["key"];

const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
  { value: "prev_month", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

function getPeriodDates(period: string): { from: string; to: string; label: string } {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (period) {
    case "7d": return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: endOfDay.toISOString(), label: "últimos 7 dias" };
    case "90d": return { from: new Date(now.getTime() - 90 * 86400000).toISOString(), to: endOfDay.toISOString(), label: "últimos 90 dias" };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: endOfDay.toISOString(), label: "este mês" };
    }
    case "prev_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString(), label: "mês anterior" };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString(), to: endOfDay.toISOString(), label: "este ano" };
    }
    default: return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: endOfDay.toISOString(), label: "últimos 30 dias" };
  }
}

type Tab = "overview" | "orders" | "franchises" | "activity";

export function AnalyticsContent({ data: initialData, ordersData: initialOrdersData, detailedData: initialDetailedData }: Props) {
  const [data, setData] = useState(initialData);
  const [ordersData, setOrdersData] = useState(initialOrdersData);
  const [detailedData, setDetailedData] = useState(initialDetailedData);
  const [tab, setTab] = useState<Tab>("overview");
  const [showExport, setShowExport] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<ExportKey>>(new Set(EXPORT_SECTIONS.map((s) => s.key)));
  const [period, setPeriod] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const [expandedFranchise, setExpandedFranchise] = useState<string | null>(null);

  function refreshAll(from: string, to: string) {
    startRefresh(async () => {
      const [newData, newOrders, newDetailed] = await Promise.all([
        getAnalyticsDashboard(from, to),
        getOrdersAnalytics(from, to),
        getDetailedAnalytics(from, to),
      ]);
      if (!("error" in newData)) setData(newData);
      if (!("error" in newOrders)) setOrdersData(newOrders);
      if (!("error" in newDetailed)) setDetailedData(newDetailed);
    });
  }

  function handlePeriodChange(value: string) {
    setPeriod(value);
    if (value !== "custom") {
      const { from, to } = getPeriodDates(value);
      refreshAll(from, to);
    }
  }

  function applyCustomPeriod() {
    if (!customFrom || !customTo) return;
    refreshAll(new Date(customFrom).toISOString(), new Date(customTo + "T23:59:59").toISOString());
  }

  const periodLabel = period === "custom" && customFrom && customTo
    ? `${new Date(customFrom).toLocaleDateString("pt-BR")} — ${new Date(customTo).toLocaleDateString("pt-BR")}`
    : getPeriodDates(period).label;

  const maxViewed = data.topViewed[0]?.count || 1;
  const maxDownloaded = data.topDownloaded[0]?.count || 1;

  const revenueChange = ordersData.prevRevenue > 0
    ? ((ordersData.totalRevenue - ordersData.prevRevenue) / ordersData.prevRevenue) * 100
    : 0;
  const ordersChange = ordersData.prevOrders > 0
    ? ((ordersData.totalOrders - ordersData.prevOrders) / ordersData.prevOrders) * 100
    : 0;

  function toggleSection(key: ExportKey) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selectedSections.size === EXPORT_SECTIONS.length) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(EXPORT_SECTIONS.map((s) => s.key)));
    }
  }

  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const sel = selectedSections;
    const date = new Date().toLocaleDateString("pt-BR");

    if (sel.has("resumo")) {
      const rows = [
        ["Métrica", "Valor", "Variação"],
        ["Visualizações (conteúdo)", data.totals.views, ""],
        ["Downloads", data.totals.downloads, ""],
        ["Usuários ativos", data.totals.activeUsers, ""],
        ["Page views (navegação)", detailedData.totalPageViews, ""],
        ["Faturamento (R$)", ordersData.totalRevenue, revenueChange ? `${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}%` : ""],
        ["Pedidos", ordersData.totalOrders, ordersChange ? `${ordersChange > 0 ? "+" : ""}${ordersChange.toFixed(1)}%` : ""],
        ["Ticket Médio (R$)", ordersData.avgTicket, ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Resumo");
    }

    if (sel.has("modulos") && detailedData.moduleUsage.length > 0) {
      const rows = [["Módulo", "Page Views", "Usuários únicos", "Franquias"], ...detailedData.moduleUsage.map((m) => [m.label, m.views, m.uniqueUsers, m.uniqueFranchises])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "Uso por Módulo");
    }

    if (sel.has("mais-visualizados") && data.topViewed.length > 0) {
      const rows = [["#", "Título", "Coleção", "Visualizações"], ...data.topViewed.map((item, i) => [i + 1, item.title, item.collection, item.count])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Mais Visualizados");
    }

    if (sel.has("mais-baixados") && data.topDownloaded.length > 0) {
      const rows = [["#", "Título", "Coleção", "Downloads"], ...data.topDownloaded.map((item, i) => [i + 1, item.title, item.collection, item.count])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Mais Baixados");
    }

    if (sel.has("pedidos-status")) {
      const statusRows: (string | number)[][] = [["Status", "Pedidos", "Faturamento (R$)"]];
      for (const [status, val] of Object.entries(ordersData.byStatus)) {
        const label = STATUS_LABELS[status]?.label || status;
        statusRows.push([label, val.count, val.revenue]);
      }
      statusRows.push(["Total", ordersData.totalOrders, ordersData.totalRevenue]);
      const ws = XLSX.utils.aoa_to_sheet(statusRows);
      ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos por Status");
    }

    if (sel.has("pedidos-produtos") && ordersData.topProducts.length > 0) {
      const rows = [["#", "Produto", "Quantidade", "Faturamento (R$)"], ...ordersData.topProducts.map((p, i) => [i + 1, p.name, p.quantity, p.revenue])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Top Produtos");
    }

    if (sel.has("pedidos-franquias") && ordersData.byFranchise.length > 0) {
      const rows: (string | number)[][] = [["Franquia", "Segmento", "Pedidos", "Faturamento (R$)"]];
      for (const f of ordersData.byFranchise) {
        rows.push([f.name, f.segment === "multimarca_pdv" ? "Multimarca" : "Franquia", f.orders, f.revenue]);
      }
      rows.push(["Total", "", ordersData.totalOrders, ordersData.totalRevenue]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos por Franquia");
    }

    if (sel.has("engajamento") && detailedData.franchiseDetails.length > 0) {
      const rows: (string | number)[][] = [["Franquia", "Page Views", "Views Conteúdo", "Downloads", "Usuários Ativos", "Última Atividade", "Módulos Acessados"]];
      for (const f of detailedData.franchiseDetails) {
        rows.push([
          f.name, f.totalPageViews, f.contentViews, f.contentDownloads, f.activeUsers,
          f.lastActivity ? new Date(f.lastActivity).toLocaleString("pt-BR") : "—",
          f.modules.map((m) => `${m.label} (${m.count})`).join(", "),
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws, "Engajamento Detalhado");

      // User-level sheet
      const userRows: (string | number)[][] = [["Franquia", "Usuário", "Page Views", "Última Atividade"]];
      for (const f of detailedData.franchiseDetails) {
        for (const u of f.users) {
          userRows.push([f.name, u.name, u.pageViews, new Date(u.lastSeen).toLocaleString("pt-BR")]);
        }
      }
      if (userRows.length > 1) {
        const ws2 = XLSX.utils.aoa_to_sheet(userRows);
        ws2["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Usuários por Franquia");
      }
    }

    if (sel.has("atividade") && detailedData.activityLog.length > 0) {
      const rows = [["Data/Hora", "Usuário", "Franquia", "Ação", "Módulo", "Descrição"],
        ...detailedData.activityLog.map((a) => [
          new Date(a.createdAt).toLocaleString("pt-BR"), a.userName, a.franchiseName || "—",
          ACTION_LABELS[a.action]?.label || a.action, a.entityType, a.description,
        ])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws, "Log de Atividade");
    }

    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `relatorio-essenza-${date.replace(/\//g, "-")}.xlsx`);
    setShowExport(false);
  }, [selectedSections, data, ordersData, detailedData, revenueChange, ordersChange]);

  // Franchise with highest engagement
  const topFranchise = detailedData.franchiseDetails[0];
  const inactiveFranchises = detailedData.franchiseDetails.filter((f) => f.totalPageViews === 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">
            Relatórios
            {isRefreshing && <Loader2 size={14} className="inline-block ml-2 animate-spin text-ink-400" />}
          </h1>
          <p className="text-sm text-ink-500">Métricas de uso, navegação e vendas — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <div className="relative">
            <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-9 rounded-lg border border-ink-100 bg-white pl-8 pr-8 text-sm text-ink-700 focus:border-brand-olive focus:outline-none appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
            >
              {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-ink-100 bg-white px-2 text-sm text-ink-700 focus:border-brand-olive focus:outline-none" />
              <span className="text-xs text-ink-400">até</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border border-ink-100 bg-white px-2 text-sm text-ink-700 focus:border-brand-olive focus:outline-none" />
              <button onClick={applyCustomPeriod} disabled={!customFrom || !customTo || isRefreshing} className="h-9 rounded-lg bg-brand-olive px-3 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
                Aplicar
              </button>
            </div>
          )}
          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
            >
              <FileSpreadsheet size={15} /> Exportar XLS
            </button>

            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-ink-100 bg-white shadow-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-ink-900">Selecione as seções</p>
                    <button onClick={toggleAll} className="text-[11px] font-medium text-brand-olive hover:text-brand-olive-dark">
                      {selectedSections.size === EXPORT_SECTIONS.length ? "Desmarcar tudo" : "Selecionar tudo"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4 max-h-64 overflow-y-auto">
                    {EXPORT_SECTIONS.map((s) => {
                      const checked = selectedSections.has(s.key);
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleSection(s.key)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                            checked ? "bg-brand-olive-soft text-brand-olive-dark" : "text-ink-600 hover:bg-ink-50"
                          )}
                        >
                          <div className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked ? "bg-brand-olive border-brand-olive" : "border-ink-200"
                          )}>
                            {checked && <Check size={10} className="text-white" />}
                          </div>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={selectedSections.size === 0}
                    className="w-full rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
                  >
                    Baixar relatório ({selectedSections.size} {selectedSections.size === 1 ? "seção" : "seções"})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Page Views", value: detailedData.totalPageViews.toLocaleString("pt-BR"), icon: MousePointerClick, color: "text-brand-olive" },
          { label: "Views Conteúdo", value: data.totals.views.toLocaleString("pt-BR"), icon: Eye, color: "text-info" },
          { label: "Downloads", value: data.totals.downloads.toLocaleString("pt-BR"), icon: Download, color: "text-success" },
          { label: "Usuários ativos", value: String(data.totals.activeUsers), icon: Users, color: "text-brand-olive" },
          { label: "Faturamento", value: formatPrice(ordersData.totalRevenue), icon: DollarSign, color: "text-success", change: revenueChange },
          { label: "Pedidos", value: String(ordersData.totalOrders), icon: ShoppingCart, color: "text-info", change: ordersChange },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-ink-500">{stat.label}</span>
              <stat.icon size={14} className={stat.color} />
            </div>
            <p className="text-lg font-semibold text-ink-900 truncate">{stat.value}</p>
            {"change" in stat && stat.change !== 0 && (
              <div className={cn("flex items-center gap-0.5 text-[10px] font-medium mt-0.5", stat.change! > 0 ? "text-success" : "text-danger")}>
                {stat.change! > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(stat.change!).toFixed(0)}% vs período anterior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1 self-start">
        {([
          { key: "overview" as Tab, label: "Conteúdo", icon: BarChart3 },
          { key: "orders" as Tab, label: "Pedidos", icon: ShoppingCart },
          { key: "franchises" as Tab, label: "Franquias", icon: Building2 },
          { key: "activity" as Tab, label: "Atividade", icon: Activity },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
            )}
          >
            <t.icon size={12} className="inline mr-1.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview (content) */}
      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          {/* Module Usage */}
          <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
              <MousePointerClick size={15} className="text-ink-400" />
              <h3 className="text-sm font-semibold text-ink-900">Uso por Módulo</h3>
              <span className="text-[11px] text-ink-400 ml-auto">{detailedData.moduleUsage.length} módulos acessados</span>
            </div>
            {detailedData.moduleUsage.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-8">Sem dados de navegação no período</p>
            ) : (
              <div className="divide-y divide-ink-50">
                {detailedData.moduleUsage.map((m) => {
                  const maxModuleViews = detailedData.moduleUsage[0]?.views || 1;
                  return (
                    <div key={m.module} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-900">{m.label}</p>
                        <p className="text-[10px] text-ink-400">{m.uniqueUsers} usuários · {m.uniqueFranchises} franquias</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 h-1.5 rounded-full bg-ink-50 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-olive/60" style={{ width: `${(m.views / maxModuleViews) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-ink-600 w-12 text-right">{m.views}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top Viewed */}
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
                <Eye size={15} className="text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-900">Mais Visualizados</h3>
              </div>
              {data.topViewed.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
              ) : (
                <div className="divide-y divide-ink-50">
                  {data.topViewed.map((item, i) => (
                    <div key={item.itemId} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs font-bold text-ink-300 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 truncate">{item.title}</p>
                        <p className="text-[10px] text-ink-400">{item.collection}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 rounded-full bg-ink-50 overflow-hidden">
                          <div className="h-full rounded-full bg-info/60" style={{ width: `${(item.count / maxViewed) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-ink-600 w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Downloaded */}
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
                <Download size={15} className="text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-900">Mais Baixados</h3>
              </div>
              {data.topDownloaded.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
              ) : (
                <div className="divide-y divide-ink-50">
                  {data.topDownloaded.map((item, i) => (
                    <div key={item.itemId} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs font-bold text-ink-300 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 truncate">{item.title}</p>
                        <p className="text-[10px] text-ink-400">{item.collection}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 rounded-full bg-ink-50 overflow-hidden">
                          <div className="h-full rounded-full bg-success/60" style={{ width: `${(item.count / maxDownloaded) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-ink-600 w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Orders */}
      {tab === "orders" && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-ink-100 bg-white px-5 py-4">
              <p className="text-[11px] text-ink-500 mb-1">Ticket Médio</p>
              <p className="text-xl font-semibold text-ink-900">{formatPrice(ordersData.avgTicket)}</p>
            </div>
            {Object.entries(ordersData.byStatus).map(([status, val]) => {
              const cfg = STATUS_LABELS[status];
              if (!cfg) return null;
              return (
                <div key={status} className="rounded-xl border border-ink-100 bg-white px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-ink-400">{val.count} pedidos</span>
                  </div>
                  <p className="text-lg font-semibold text-ink-900">{formatPrice(val.revenue)}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top Products */}
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
                <Package size={15} className="text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-900">Top Produtos</h3>
              </div>
              {ordersData.topProducts.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
              ) : (
                <div className="divide-y divide-ink-50">
                  {ordersData.topProducts.map((p, i) => {
                    const maxRev = ordersData.topProducts[0]?.revenue || 1;
                    return (
                      <div key={p.name} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xs font-bold text-ink-300 w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-ink-400">{p.quantity} unidades</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 rounded-full bg-ink-50 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-olive/60" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                          </div>
                          <span className="text-xs font-medium text-ink-600 w-16 text-right">{formatPrice(p.revenue)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Revenue by Franchise */}
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
                <Building2 size={15} className="text-ink-400" />
                <h3 className="text-sm font-semibold text-ink-900">Faturamento por Franquia</h3>
              </div>
              {ordersData.byFranchise.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/30">
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Franquia</th>
                        <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Pedidos</th>
                        <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Faturamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersData.byFranchise.map((f) => (
                        <tr key={f.franchiseId} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-ink-900">{f.name}</p>
                            <p className="text-[10px] text-ink-400">{f.segment === "multimarca_pdv" ? "Multimarca" : "Franquia"}</p>
                          </td>
                          <td className="px-5 py-3 text-right text-ink-600">{f.orders}</td>
                          <td className="px-5 py-3 text-right font-semibold text-ink-900">{formatPrice(f.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ink-50/30">
                        <td className="px-5 py-2.5 text-sm font-medium text-ink-700">Total</td>
                        <td className="px-5 py-2.5 text-right text-sm font-medium text-ink-700">{ordersData.totalOrders}</td>
                        <td className="px-5 py-2.5 text-right text-sm font-bold text-ink-900">{formatPrice(ordersData.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Franchises — detailed engagement with drill-down */}
      {tab === "franchises" && (
        <div className="flex flex-col gap-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <p className="text-[11px] text-ink-500 mb-1">Franquias ativas</p>
              <p className="text-lg font-semibold text-ink-900">{detailedData.franchiseDetails.filter((f) => f.totalPageViews > 0).length}</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <p className="text-[11px] text-ink-500 mb-1">Sem atividade</p>
              <p className="text-lg font-semibold text-danger">{inactiveFranchises.length}</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <p className="text-[11px] text-ink-500 mb-1">Mais engajada</p>
              <p className="text-sm font-semibold text-ink-900 truncate">{topFranchise?.name || "—"}</p>
              {topFranchise && <p className="text-[10px] text-ink-400">{topFranchise.totalPageViews} page views</p>}
            </div>
            <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <p className="text-[11px] text-ink-500 mb-1">Módulos acessados</p>
              <p className="text-lg font-semibold text-ink-900">{detailedData.moduleUsage.length}</p>
            </div>
          </div>

          {/* Franchise table with drill-down */}
          <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
              <TrendingUp size={15} className="text-ink-400" />
              <h3 className="text-sm font-semibold text-ink-900">Engajamento por Franquia</h3>
              <span className="text-[11px] text-ink-400 ml-auto">Clique para expandir</span>
            </div>
            {detailedData.franchiseDetails.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/30">
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-ink-400 uppercase w-8"></th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Franquia</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Page Views</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Views</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Downloads</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Usuários</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Última atividade</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-ink-400 w-28">Engajamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedData.franchiseDetails.map((f) => {
                      const isExpanded = expandedFranchise === f.franchiseId;
                      const maxPv = detailedData.franchiseDetails[0]?.totalPageViews || 1;
                      const isInactive = f.totalPageViews === 0;
                      return (
                        <Fragment key={f.franchiseId}>
                          <tr
                            onClick={() => setExpandedFranchise(isExpanded ? null : f.franchiseId)}
                            className={cn(
                              "border-b border-ink-50 cursor-pointer transition-colors",
                              isExpanded ? "bg-brand-olive-soft/30" : "hover:bg-ink-50/50",
                              isInactive && "opacity-50"
                            )}
                          >
                            <td className="px-5 py-3">
                              {isExpanded ? <ChevronDown size={14} className="text-brand-olive" /> : <ChevronRight size={14} className="text-ink-400" />}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 size={14} className="text-ink-400 shrink-0" />
                                <span className="font-medium text-ink-900">{f.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-medium text-ink-900">{f.totalPageViews}</td>
                            <td className="px-3 py-3 text-right text-ink-600">{f.contentViews}</td>
                            <td className="px-3 py-3 text-right text-ink-600">{f.contentDownloads}</td>
                            <td className="px-3 py-3 text-right">
                              <span className={cn("inline-flex items-center gap-1", f.activeUsers > 0 ? "text-ink-900" : "text-ink-400")}>
                                <UserCheck size={12} />
                                {f.activeUsers}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right text-ink-500 text-xs">
                              {f.lastActivity ? (
                                <span className="flex items-center gap-1 justify-end">
                                  <Clock size={11} />
                                  {timeAgo(f.lastActivity)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-3">
                              <div className="w-full h-1.5 rounded-full bg-ink-50 overflow-hidden">
                                <div className="h-full rounded-full bg-brand-olive/60" style={{ width: `${(f.totalPageViews / maxPv) * 100}%` }} />
                              </div>
                            </td>
                          </tr>
                          {/* Expanded detail */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-ink-50/40 px-5 py-4">
                                <div className="grid gap-4 lg:grid-cols-2">
                                  {/* Modules accessed */}
                                  <div>
                                    <h4 className="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-1.5">
                                      <BarChart3 size={12} />
                                      Módulos acessados
                                    </h4>
                                    {f.modules.length === 0 ? (
                                      <p className="text-xs text-ink-400">Nenhum módulo acessado</p>
                                    ) : (
                                      <div className="flex flex-col gap-1.5">
                                        {f.modules.map((m) => (
                                          <div key={m.module} className="flex items-center gap-2">
                                            <span className="text-xs text-ink-700 w-28 truncate">{m.label}</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                                              <div className="h-full rounded-full bg-brand-olive/50" style={{ width: `${(m.count / (f.modules[0]?.count || 1)) * 100}%` }} />
                                            </div>
                                            <span className="text-[11px] font-medium text-ink-600 w-8 text-right">{m.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {/* Users */}
                                  <div>
                                    <h4 className="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-1.5">
                                      <Users size={12} />
                                      Usuários ({f.users.length})
                                    </h4>
                                    {f.users.length === 0 ? (
                                      <p className="text-xs text-ink-400">Nenhum usuário ativo</p>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {f.users.map((u, i) => (
                                          <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                                            <div className="h-6 w-6 rounded-full bg-brand-olive-soft flex items-center justify-center">
                                              <span className="text-[10px] font-bold text-brand-olive">{u.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium text-ink-900 truncate">{u.name}</p>
                                              <p className="text-[10px] text-ink-400">{u.pageViews} page views</p>
                                            </div>
                                            <span className="text-[10px] text-ink-400 flex items-center gap-0.5">
                                              <Clock size={9} />
                                              {timeAgo(u.lastSeen)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive franchises callout */}
          {inactiveFranchises.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft/20 px-5 py-4">
              <p className="text-sm font-medium text-warning-dark mb-1">
                {inactiveFranchises.length} franquia{inactiveFranchises.length > 1 ? "s" : ""} sem atividade no período
              </p>
              <p className="text-xs text-ink-500">
                {inactiveFranchises.map((f) => f.name).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity Log */}
      {tab === "activity" && (
        <div className="flex flex-col gap-5">
          {/* Module usage summary as horizontal pills */}
          {detailedData.moduleUsage.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detailedData.moduleUsage.slice(0, 12).map((m) => (
                <div key={m.module} className="inline-flex items-center gap-1.5 rounded-full border border-ink-100 bg-white px-3 py-1.5">
                  <span className="text-xs font-medium text-ink-700">{m.label}</span>
                  <span className="text-[10px] text-ink-400">{m.views}</span>
                </div>
              ))}
            </div>
          )}

          {/* Activity log */}
          <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
              <Activity size={15} className="text-ink-400" />
              <h3 className="text-sm font-semibold text-ink-900">Log de Atividade</h3>
              <span className="text-[11px] text-ink-400 ml-auto">{detailedData.activityLog.length} ações no período</span>
            </div>
            {detailedData.activityLog.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-8">Sem atividade registrada no período</p>
            ) : (
              <div className="divide-y divide-ink-50 max-h-[600px] overflow-y-auto">
                {detailedData.activityLog.map((entry) => {
                  const actionCfg = ACTION_LABELS[entry.action];
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-5 py-3 hover:bg-ink-50/30 transition-colors">
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-ink-50 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-ink-500">{entry.userName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-ink-900">{entry.userName}</span>
                          {entry.franchiseName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] text-ink-500">
                              <Building2 size={9} />
                              {entry.franchiseName}
                            </span>
                          )}
                          <span className={cn("text-[10px] font-medium", actionCfg?.color || "text-ink-500")}>
                            {actionCfg?.label || entry.action}
                          </span>
                          <span className="text-[10px] text-ink-300">em</span>
                          <span className="text-[10px] font-medium text-ink-500">{entry.entityType}</span>
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5 truncate">{entry.description}</p>
                      </div>
                      <span className="text-[10px] text-ink-400 shrink-0 flex items-center gap-0.5 mt-1">
                        <Clock size={9} />
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

