"use client";

import { useState } from "react";
import {
  BarChart3, Eye, Download, Users, Building2, TrendingUp, FileText,
  ShoppingCart, DollarSign, Package, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function AnalyticsContent({ data, ordersData }: Props) {
  const [tab, setTab] = useState<"overview" | "franchises" | "orders">("overview");

  const maxViewed = data.topViewed[0]?.count || 1;
  const maxDownloaded = data.topDownloaded[0]?.count || 1;

  const revenueChange = ordersData.prevRevenue > 0
    ? ((ordersData.totalRevenue - ordersData.prevRevenue) / ordersData.prevRevenue) * 100
    : 0;
  const ordersChange = ordersData.prevOrders > 0
    ? ((ordersData.totalOrders - ordersData.prevOrders) / ordersData.prevOrders) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Relatórios</h1>
        <p className="text-sm text-ink-500">Métricas de uso e vendas dos últimos 30 dias</p>
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
