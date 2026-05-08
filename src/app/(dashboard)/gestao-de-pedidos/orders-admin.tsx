"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Search, Filter, Download, ChevronRight, Package, Clock, CheckCircle,
  Truck, FileText, XCircle, Pencil, Minus, Plus, Save, X, BarChart3,
  CalendarDays, Printer,
} from "lucide-react";
import { updateOrderStatus, updateOrderItem, updateOrderNotes } from "@/app/(dashboard)/novo-pedido/actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "sonner";
import Link from "next/link";
import { usePagination } from "@/hooks/use-pagination";
import { format, startOfMonth, endOfDay, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }
interface Franchise { id: string; name: string; segment?: string; status?: string }
interface Order {
  id: string; status: string; total: number; notes: string | null; admin_notes: string | null;
  created_at: string; sent_at: string | null; approved_at: string | null;
  franchise: Franchise | null; items: OrderItem[];
  creator_name: string | null;
}
interface Stats { pending: number; today: number; week: number; month: number }
interface Permissions { canApprove: boolean; canEdit: boolean; canExport: boolean; canDelete: boolean; canManageProducts: boolean }

const STATUS_FLOW = ["enviado", "aprovado", "separacao", "faturado"] as const;
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  rascunho: { label: "Rascunho", icon: Clock, color: "text-ink-500", bg: "bg-ink-100" },
  enviado: { label: "Enviado", icon: Package, color: "text-info", bg: "bg-info-soft" },
  aprovado: { label: "Aprovado", icon: CheckCircle, color: "text-success", bg: "bg-success-soft" },
  separacao: { label: "Em Separação", icon: Truck, color: "text-warning", bg: "bg-warning-soft" },
  faturado: { label: "Faturado", icon: FileText, color: "text-brand-olive", bg: "bg-brand-olive-soft" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-danger", bg: "bg-danger-soft" },
};

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function formatDateTime(d: string) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

export function OrdersAdmin({ orders, stats, franchises, permissions: perms }: { orders: Order[]; stats: Stats; franchises: Franchise[]; permissions: Permissions }) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFranchise, setFilterFranchise] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Detail sheet
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, number>>({});
  const [adminNotes, setAdminNotes] = useState("");

  const maxDate = new Date();
  const minDate = subDays(maxDate, 90);

  function handleDateSelect(range: DateRange | undefined) {
    if (range?.from && range?.to && differenceInDays(range.to, range.from) > 90) {
      toast.error("Período máximo de 90 dias");
      return;
    }
    setDateRange(range);
    if (range?.from && range?.to) setCalendarOpen(false);
  }

  const periodLabel = useMemo(() => {
    if (!dateRange?.from) return "Selecionar período";
    const fromStr = format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
    if (!dateRange.to) return `${fromStr} até ...`;
    const isToday = format(dateRange.to, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
    const toStr = isToday ? "hoje" : format(dateRange.to, "dd/MM/yyyy", { locale: ptBR });
    return `${fromStr} até ${toStr}`;
  }, [dateRange]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.franchise?.name?.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchFranchise = !filterFranchise || o.franchise?.id === filterFranchise;
    const orderDate = new Date(o.created_at);
    const matchDateFrom = !dateRange?.from || orderDate >= dateRange.from;
    const matchDateTo = !dateRange?.to || orderDate <= endOfDay(dateRange.to);
    return matchSearch && matchStatus && matchFranchise && matchDateFrom && matchDateTo;
  });

  const { paginated: paginatedOrders, hasMore: hasMoreOrders, loadMore: loadMoreOrders, showing: showingOrders } = usePagination(filtered, { pageSize: 20 });

  function openDetail(order: Order) {
    setDetailOrder(order);
    setEditingItems({});
    setAdminNotes(order.admin_notes || "");
  }

  function handleStatusChange(orderId: string, status: string) {
    // Optimistic update no drawer
    if (detailOrder && detailOrder.id === orderId) {
      setDetailOrder({ ...detailOrder, status });
    }
    startTransition(async () => {
      const r = await updateOrderStatus(orderId, status);
      if (r?.error) {
        toast.error(r.error);
        // Revert on error
        if (detailOrder && detailOrder.id === orderId) {
          setDetailOrder(detailOrder);
        }
      } else {
        toast.success(`Status alterado para ${STATUS_CONFIG[status]?.label}`);
      }
    });
  }

  function handleItemQtyChange(itemId: string, qty: number) {
    setEditingItems((prev) => ({ ...prev, [itemId]: qty }));
  }

  function handleSaveItem(itemId: string) {
    const qty = editingItems[itemId];
    if (qty === undefined) return;
    startTransition(async () => {
      const r = await updateOrderItem(itemId, qty);
      if (r?.error) toast.error(r.error);
      else { toast.success("Quantidade atualizada"); setEditingItems((prev) => { const n = { ...prev }; delete n[itemId]; return n; }); }
    });
  }

  function handleSaveNotes() {
    if (!detailOrder) return;
    startTransition(async () => {
      const r = await updateOrderNotes(detailOrder.id, adminNotes);
      if (r?.error) toast.error(r.error);
      else toast.success("Observações salvas");
    });
  }

  function getNextStatus(current: string): string | null {
    const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number]);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  }

  function generateOrderText(order: Order) {
    let text = `PEDIDO #${order.id.slice(0, 8)}\n`;
    text += `Franquia: ${order.franchise?.name || "—"}\n`;
    text += `Data: ${formatDateTime(order.created_at)}\n`;
    text += `Status: ${STATUS_CONFIG[order.status]?.label}\n\n`;
    text += `ITENS:\n`;
    order.items.forEach((item) => {
      text += `  ${item.product_name} — ${item.quantity}x ${formatPrice(item.unit_price)} = ${formatPrice(item.subtotal)}\n`;
    });
    text += `\nTOTAL: ${formatPrice(order.total)}`;
    if (order.notes) text += `\n\nObs cliente: ${order.notes}`;
    if (order.admin_notes) text += `\nObs admin: ${order.admin_notes}`;
    return text;
  }

  function handleExportOrder(order: Order) {
    const text = generateOrderText(order);
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.download = `pedido-${order.id.slice(0, 8)}-${order.franchise?.name?.replace(/\s+/g, "-").toLowerCase() || "franquia"}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  function handlePrintOrder(order: Order) {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }

    const itemsRows = order.items.map((item) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;font-size:13px">${item.product_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:center;font-size:13px">${item.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:right;font-size:13px">${formatPrice(item.unit_price)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:right;font-size:13px;font-weight:600">${formatPrice(item.subtotal)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido #${order.id.slice(0, 8)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color:#18160f; padding:32px; max-width:800px; margin:0 auto; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #878a62; }
    .brand { font-size:22px; font-weight:700; color:#878a62; letter-spacing:1px; }
    .brand small { display:block; font-size:11px; font-weight:400; color:#6b6b5e; letter-spacing:0; margin-top:2px; }
    .order-id { text-align:right; }
    .order-id .id { font-size:18px; font-weight:700; color:#18160f; font-family:monospace; }
    .order-id .date { font-size:12px; color:#6b6b5e; margin-top:2px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; }
    .info-box label { font-size:10px; text-transform:uppercase; color:#6b6b5e; letter-spacing:0.5px; display:block; margin-bottom:2px; }
    .info-box p { font-size:14px; font-weight:500; }
    .status-badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; }
    thead th { padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; color:#6b6b5e; letter-spacing:0.5px; background:#f5f4ef; border-bottom:2px solid #e8e8e0; }
    thead th:nth-child(2) { text-align:center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align:right; }
    .total-row { background:#f5f4ef; }
    .total-row td { padding:10px; font-size:15px; font-weight:700; text-align:right; }
    .notes { margin-top:20px; padding:12px 16px; background:#f5f4ef; border-radius:8px; font-size:12px; color:#4a4a3e; }
    .notes strong { display:block; font-size:10px; text-transform:uppercase; color:#6b6b5e; margin-bottom:4px; letter-spacing:0.5px; }
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e8e8e0; text-align:center; font-size:10px; color:#999; }
    @media print {
      body { padding:16px; }
      @page { margin:12mm; size:A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">EMPÓRIO ESSENZA<small>Brand Hub — Pedido</small></div>
    </div>
    <div class="order-id">
      <div class="id">#${order.id.slice(0, 8).toUpperCase()}</div>
      <div class="date">${formatDateTime(order.created_at)}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <label>Franquia</label>
      <p>${order.franchise?.name || "—"}</p>
    </div>
    <div class="info-box">
      <label>Solicitante</label>
      <p>${order.creator_name || "—"}</p>
    </div>
    <div class="info-box">
      <label>Status</label>
      <p><span class="status-badge" style="background:${
        order.status === "aprovado" ? "#dcfce7;color:#166534" :
        order.status === "faturado" ? "#f0e8d6;color:#5a5735" :
        order.status === "separacao" ? "#fef3c7;color:#92400e" :
        order.status === "cancelado" ? "#fef2f2;color:#991b1b" :
        "#dbeafe;color:#1e40af"
      }">${STATUS_CONFIG[order.status]?.label || order.status}</span></p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Unitário</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding-right:10px">TOTAL</td>
        <td style="text-align:right;padding-right:10px">${formatPrice(order.total)}</td>
      </tr>
    </tfoot>
  </table>

  ${order.notes ? `<div class="notes"><strong>Observações do cliente</strong>${order.notes}</div>` : ""}
  ${order.admin_notes ? `<div class="notes" style="margin-top:8px"><strong>Observações do comercial</strong>${order.admin_notes}</div>` : ""}

  <div class="footer">Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — Empório Essenza Brand Hub</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  }

  function handleExportAll() {
    const BOM = "\uFEFF";
    const sep = ";";
    const header = ["Pedido", "Franquia", "Segmento", "Status", "Data", "Solicitante", "Produto", "Qtd", "Unitário", "Subtotal", "Total Pedido", "Obs Cliente", "Obs Comercial"].join(sep);
    const rows: string[] = [];

    filtered.forEach((o) => {
      const base = [
        `#${o.id.slice(0, 8)}`,
        o.franchise?.name || "—",
        o.franchise?.segment === "multimarca_pdv" ? "Multimarca" : "Franquia",
        STATUS_CONFIG[o.status]?.label || o.status,
        formatDate(o.created_at),
        o.creator_name || "—",
      ];
      if (o.items.length === 0) {
        rows.push([...base, "", "", "", "", formatPrice(o.total), (o.notes || "").replace(/;/g, ","), (o.admin_notes || "").replace(/;/g, ",")].join(sep));
      } else {
        o.items.forEach((item, idx) => {
          rows.push([
            ...base,
            item.product_name.replace(/;/g, ","),
            String(item.quantity),
            formatPrice(item.unit_price),
            formatPrice(item.subtotal),
            idx === 0 ? formatPrice(o.total) : "",
            idx === 0 ? (o.notes || "").replace(/;/g, ",") : "",
            idx === 0 ? (o.admin_notes || "").replace(/;/g, ",") : "",
          ].join(sep));
        });
      }
    });

    const csv = BOM + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `pedidos-essenza-${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    toast.success(`${filtered.length} pedidos exportados`);
  }

  const statusOptions = [
    { value: "", label: "Todos status" },
    ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
  ];
  const franchiseOptions = [
    { value: "", label: "Todas franquias" },
    ...franchises.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Gestão de Pedidos</h1>
          <p className="text-sm text-ink-500">{orders.length} pedidos · {stats.pending} pendentes</p>
        </div>
        {perms.canExport && (
          <button onClick={handleExportAll} className="flex items-center gap-2 rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        )}
      </div>

      {/* Stats — inline compact */}
      <div className="flex items-center gap-4 mb-5 overflow-x-auto pb-1">
        {[
          { label: "Pendentes", value: stats.pending, color: "text-warning bg-warning-soft" },
          { label: "Hoje", value: stats.today, color: "text-info bg-info-soft" },
          { label: "Semana", value: stats.week, color: "text-success bg-success-soft" },
          { label: "Mês", value: stats.month, color: "text-brand-olive bg-brand-olive-soft" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 shrink-0">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold", s.color)}>{s.value}</span>
            <span className="text-xs text-ink-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters — single row */}
      <div className="flex flex-col gap-2 mb-4">
        {/* Row 1: Search + Calendar */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 flex-1 min-w-0">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none min-w-0" />
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-3 h-9 text-xs sm:text-sm text-ink-600 hover:border-ink-200 transition-colors shrink-0">
                <CalendarDays size={13} className="shrink-0" />
                <span className="whitespace-nowrap hidden sm:inline">{periodLabel}</span>
                <span className="sm:hidden">{dateRange?.from ? format(dateRange.from, "dd/MM") : "Período"}</span>
              </button>
            </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              disabled={{ before: minDate, after: maxDate }}
              defaultMonth={dateRange?.from}
            />
            <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2">
              <p className="text-[10px] text-ink-400">Máx. 90 dias</p>
              <button
                onClick={() => { setDateRange(undefined); setCalendarOpen(false); }}
                className="text-xs text-ink-500 hover:text-ink-900 transition-colors"
              >
                Limpar filtro
              </button>
            </div>
          </PopoverContent>
        </Popover>
        </div>
        {/* Row 2: Status + Franchise */}
        <div className="flex gap-2">
          <div className="flex-1"><CustomSelect options={statusOptions} value={filterStatus} onChange={setFilterStatus} /></div>
          <div className="flex-1"><CustomSelect options={franchiseOptions} value={filterFranchise} onChange={setFilterFranchise} /></div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ink-500">
          {filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"}
          {dateRange?.from && <> · <span className="text-ink-700 font-medium">{periodLabel}</span></>}
        </p>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/30">
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Pedido</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Franquia</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Status</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase hidden md:table-cell">Itens</th>
              <th className="px-3 md:px-4 py-2.5 text-right text-xs font-medium text-ink-400 uppercase hidden sm:table-cell">Total</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase hidden lg:table-cell">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-400">Nenhum pedido encontrado</td></tr>
            ) : paginatedOrders.map((o) => {
              const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.rascunho;
              const Icon = cfg.icon;
              const nextStatus = getNextStatus(o.status);
              return (
                <tr key={o.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors cursor-pointer" onClick={() => openDetail(o)}>
                  <td className="px-3 md:px-4 py-3">
                    <p className="font-mono text-[11px] font-medium text-ink-900">#{o.id.slice(0, 8)}</p>
                    <p className="text-[10px] text-ink-400 truncate max-w-[80px]">{o.creator_name || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full shrink-0", o.franchise?.status === "active" ? "bg-success" : "bg-ink-300")} />
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900 text-xs sm:text-sm truncate">{o.franchise?.name || "—"}</p>
                        <p className="text-[10px] text-ink-400 hidden sm:block">{o.franchise?.segment === "multimarca_pdv" ? "Multimarca" : "Franquia"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium", cfg.bg, cfg.color)}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden md:table-cell text-ink-600 text-xs">{o.items.length} {o.items.length === 1 ? "item" : "itens"}</td>
                  <td className="px-3 md:px-4 py-3 text-right font-semibold text-ink-900 text-xs hidden sm:table-cell">{formatPrice(o.total)}</td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell text-ink-500 text-xs">{formatDateTime(o.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMoreOrders && (
        <div className="flex justify-center mt-3">
          <button onClick={loadMoreOrders} className="rounded-lg border border-ink-200 px-5 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            Carregar mais ({showingOrders} de {filtered.length})
          </button>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detailOrder} onClose={() => setDetailOrder(null)} title={detailOrder ? `Pedido #${detailOrder.id.slice(0, 8)}` : ""} wide>
        {detailOrder && (() => {
          const o = detailOrder;
          const cfg = STATUS_CONFIG[o.status];
          const nextStatus = getNextStatus(o.status);
          return (
            <div className="flex flex-col gap-5">
              {/* Header info */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-ink-400 uppercase">Franquia</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("size-2 rounded-full shrink-0", o.franchise?.status === "active" ? "bg-success" : "bg-ink-300")} />
                    <p className="text-sm font-medium text-ink-900">{o.franchise?.name || "—"}</p>
                  </div>
                  <p className="text-[10px] text-ink-400">{o.franchise?.status === "active" ? "Ativa" : "Inativa"}{o.franchise?.segment === "multimarca_pdv" ? " · Multimarca" : " · Franquia"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 uppercase">Solicitante</p>
                  <p className="text-sm text-ink-900">{o.creator_name || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 uppercase">Data</p>
                  <p className="text-sm text-ink-900">{formatDateTime(o.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 uppercase">Status</p>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-0.5", cfg.bg, cfg.color)}>
                    <cfg.icon size={11} /> {cfg.label}
                  </span>
                </div>
              </div>

              {/* Status actions — only if can approve */}
              {perms.canApprove && (
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUS_FLOW.map((s) => {
                    const sc = STATUS_CONFIG[s];
                    const isCurrent = o.status === s;
                    const isPast = STATUS_FLOW.indexOf(o.status as typeof STATUS_FLOW[number]) > STATUS_FLOW.indexOf(s);
                    return (
                      <button
                        key={s}
                        onClick={() => !isCurrent && handleStatusChange(o.id, s)}
                        disabled={isPending || isCurrent}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                          isCurrent ? `${sc.bg} ${sc.color} border-current` : isPast ? "bg-ink-50 text-ink-400 border-transparent" : "border-ink-200 text-ink-600 hover:border-ink-300"
                        )}
                      >
                        <sc.icon size={12} /> {sc.label}
                      </button>
                    );
                  })}
                  {o.status !== "cancelado" && perms.canDelete && (
                    <button onClick={() => handleStatusChange(o.id, "cancelado")} disabled={isPending} className="flex items-center gap-1 rounded-lg border border-danger-soft px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft transition-colors ml-auto">
                      <XCircle size={12} /> Cancelar
                    </button>
                  )}
                </div>
              )}

              {/* Items — editable */}
              <div>
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Itens do pedido</p>
                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50/30 border-b border-ink-100">
                        <th className="px-4 py-2 text-left text-xs font-medium text-ink-400">Produto</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-ink-400 w-32">Qtd</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-ink-400">Unitário</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-ink-400">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((item) => {
                        const isEditing = editingItems[item.id] !== undefined;
                        const displayQty = isEditing ? editingItems[item.id] : item.quantity;
                        return (
                          <tr key={item.id} className="border-b border-ink-50 last:border-0">
                            <td className="px-4 py-2.5 text-ink-900">{item.product_name}</td>
                            <td className="px-4 py-2.5">
                              {perms.canEdit ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => handleItemQtyChange(item.id, Math.max(0, displayQty - 1))} className="flex h-6 w-6 items-center justify-center rounded border border-ink-200 text-ink-500 hover:bg-ink-50"><Minus size={10} /></button>
                                  <span className="w-8 text-center text-sm font-medium text-ink-900">{displayQty}</span>
                                  <button onClick={() => handleItemQtyChange(item.id, displayQty + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-ink-200 text-ink-500 hover:bg-ink-50"><Plus size={10} /></button>
                                  {isEditing && (
                                    <button onClick={() => handleSaveItem(item.id)} disabled={isPending} className="flex h-6 w-6 items-center justify-center rounded bg-brand-olive text-white hover:bg-brand-olive-dark">
                                      <Save size={10} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-center block text-sm text-ink-600">{displayQty}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-ink-600">{formatPrice(item.unit_price)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-ink-900">{formatPrice(displayQty * item.unit_price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ink-50/30">
                        <td colSpan={3} className="px-4 py-2.5 text-right text-sm font-medium text-ink-700">Total</td>
                        <td className="px-4 py-2.5 text-right text-base font-bold text-ink-900">{formatPrice(o.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Obs. do cliente</p>
                  <p className="text-sm text-ink-600 bg-ink-50 rounded-lg px-3 py-2 min-h-[40px]">{o.notes || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Obs. do comercial</p>
                  <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" placeholder="Observações internas..." />
                  <button onClick={handleSaveNotes} disabled={isPending} className="mt-1 text-[10px] font-medium text-brand-olive hover:text-brand-olive-dark">Salvar obs.</button>
                </div>
              </div>

              {/* Export & Print */}
              <div className="flex gap-2 pt-3 border-t border-ink-100 flex-wrap">
                <button onClick={() => handlePrintOrder(o)} className="flex items-center gap-2 rounded-lg bg-brand-olive text-white px-4 py-2 text-xs font-medium hover:bg-brand-olive-dark transition-colors">
                  <Printer size={13} /> Imprimir
                </button>
                {perms.canExport && (
                  <>
                    <button onClick={() => handleExportOrder(o)} className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                      <Download size={13} /> Exportar TXT
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(generateOrderText(o)); toast.success("Copiado"); }} className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                      <FileText size={13} /> Copiar texto
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
