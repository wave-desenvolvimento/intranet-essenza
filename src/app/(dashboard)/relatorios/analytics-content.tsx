"use client";

import { useState, useCallback } from "react";
import {
  BarChart3, Eye, Download, Users, Building2, TrendingUp, FileText,
  ShoppingCart, DollarSign, Package, ArrowUpRight, ArrowDownRight,
  FileSpreadsheet, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

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

interface Props {
  data: {
    totals: { views: number; downloads: number; activeUsers: number };
    topViewed: TopItem[];
    topDownloaded: TopItem[];
    byFranchise: FranchiseStats[];
  };
  ordersData: OrdersData;
}

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  enviado: { label: "Enviado", color: "text-info", bg: "bg-info-soft" },
  aprovado: { label: "Aprovado", color: "text-success", bg: "bg-success-soft" },
  separacao: { label: "Em Separação", color: "text-warning", bg: "bg-warning-soft" },
  faturado: { label: "Faturado", color: "text-brand-olive", bg: "bg-brand-olive-soft" },
  cancelado: { label: "Cancelado", color: "text-danger", bg: "bg-danger-soft" },
};

const EXPORT_SECTIONS = [
  { key: "resumo", label: "Resumo geral" },
  { key: "mais-visualizados", label: "Conteúdo — Mais visualizados" },
  { key: "mais-baixados", label: "Conteúdo — Mais baixados" },
  { key: "pedidos-status", label: "Pedidos — Por status" },
  { key: "pedidos-produtos", label: "Pedidos — Top produtos" },
  { key: "pedidos-franquias", label: "Pedidos — Por franquia" },
  { key: "engajamento", label: "Franquias — Engajamento" },
] as const;

type ExportKey = (typeof EXPORT_SECTIONS)[number]["key"];

export function AnalyticsContent({ data, ordersData }: Props) {
  const [tab, setTab] = useState<"overview" | "franchises" | "orders">("overview");
  const [showExport, setShowExport] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<ExportKey>>(new Set(EXPORT_SECTIONS.map((s) => s.key)));

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
        ["Visualizações", data.totals.views, ""],
        ["Downloads", data.totals.downloads, ""],
        ["Usuários ativos", data.totals.activeUsers, ""],
        ["Faturamento (R$)", ordersData.totalRevenue, revenueChange ? `${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}%` : ""],
        ["Pedidos", ordersData.totalOrders, ordersChange ? `${ordersChange > 0 ? "+" : ""}${ordersChange.toFixed(1)}%` : ""],
        ["Ticket Médio (R$)", ordersData.avgTicket, ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Resumo");
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

    if (sel.has("engajamento") && data.byFranchise.length > 0) {
      const rows = [["Franquia", "Visualizações", "Downloads", "Total"], ...data.byFranchise.map((f) => [f.name, f.views, f.downloads, f.views + f.downloads])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, "Engajamento Franquias");
    }

    if (wb.SheetNames.length === 0) return;

    XLSX.writeFile(wb, `relatorio-essenza-${date.replace(/\//g, "-")}.xlsx`);
    setShowExport(false);
  }, [selectedSections, data, ordersData, revenueChange, ordersChange]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Relatórios</h1>
          <p className="text-sm text-ink-500">Métricas de uso e vendas dos últimos 30 dias</p>
        </div>
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
                <div className="flex flex-col gap-1.5 mb-4">
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Visualizações", value: data.totals.views.toLocaleString("pt-BR"), icon: Eye, color: "text-info" },
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
                {Math.abs(stat.change!).toFixed(0)}% vs mês anterior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1 self-start">
        {([
          { key: "overview", label: "Conteúdo", icon: BarChart3 },
          { key: "orders", label: "Pedidos", icon: ShoppingCart },
          { key: "franchises", label: "Franquias", icon: Building2 },
        ] as const).map((t) => (
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
      )}

      {/* Tab: Orders */}
      {tab === "orders" && (
        <div className="flex flex-col gap-5">
          {/* Ticket médio + Status breakdown */}
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

      {/* Tab: Franchises (content engagement) */}
      {tab === "franchises" && (
        <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
            <TrendingUp size={15} className="text-ink-400" />
            <h3 className="text-sm font-semibold text-ink-900">Engajamento por Franquia</h3>
          </div>
          {data.byFranchise.length === 0 ? (
            <p className="text-xs text-ink-400 text-center py-8">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/30">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Franquia</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Visualizações</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Downloads</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Total</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-ink-400 w-32">Engajamento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFranchise.map((f) => {
                    const total = f.views + f.downloads;
                    const maxTotal = data.byFranchise[0] ? data.byFranchise[0].views + data.byFranchise[0].downloads : 1;
                    return (
                      <tr key={f.franchiseId} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-ink-900">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-ink-400" />
                            {f.name}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-ink-600">{f.views}</td>
                        <td className="px-5 py-3 text-right text-ink-600">{f.downloads}</td>
                        <td className="px-5 py-3 text-right font-medium text-ink-900">{total}</td>
                        <td className="px-5 py-3">
                          <div className="w-full h-1.5 rounded-full bg-ink-50 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-olive/60" style={{ width: `${(total / maxTotal) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
