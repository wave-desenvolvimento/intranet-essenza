"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Search, Download, ChevronRight, Package, Clock, CheckCircle,
  Truck, FileText, XCircle, Minus, Plus, Save, X, BarChart3,
  CalendarDays, Printer, Trash2, User,
} from "lucide-react";
import { updateOrderStatus, updateOrder } from "@/app/(dashboard)/novo-pedido/actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "sonner";
import { usePagination } from "@/hooks/use-pagination";
import { format, startOfMonth, endOfDay, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

interface OrderItem { id: string; product_id?: string; product_name: string; quantity: number; unit_price: number; subtotal: number }
interface ProductPrice { segment: string; price: number }
interface Product { id: string; name: string; sku: string | null; category: string | null; prices: ProductPrice[] }
interface Franchise { id: string; name: string; segment?: string; status?: string }
interface PaymentPlan { id: string; name: string }
interface ShippingType { id: string; name: string }
interface Order {
  id: string; status: string; total: number; notes: string | null; admin_notes: string | null;
  created_at: string; sent_at: string | null; approved_at: string | null;
  purchase_order: string | null; seller_id: string | null;
  franchise: Franchise | null; items: OrderItem[];
  payment_plan: PaymentPlan | null; shipping_type: ShippingType | null;
  creator_name: string | null; seller_name: string | null;
}
interface Stats { pending: number; today: number; week: number; month: number }
interface Permissions { canApprove: boolean; canEdit: boolean; canExport: boolean; canDelete: boolean; canManageProducts: boolean }

const STATUS_FLOW = ["pendente", "aprovado", "confirmado", "separacao", "faturado", "entregue"] as const;
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; step: number }> = {
  pendente: { label: "Pendente", icon: Clock, color: "text-warning", bg: "bg-warning-soft", step: 0 },
  aprovado: { label: "Aprovado", icon: CheckCircle, color: "text-info", bg: "bg-info-soft", step: 1 },
  confirmado: { label: "Confirmado", icon: CheckCircle, color: "text-success", bg: "bg-success-soft", step: 2 },
  separacao: { label: "Em Separação", icon: Truck, color: "text-warning", bg: "bg-warning-soft", step: 3 },
  faturado: { label: "Faturado", icon: FileText, color: "text-brand-olive", bg: "bg-brand-olive-soft", step: 4 },
  entregue: { label: "Entregue", icon: CheckCircle, color: "text-brand-olive", bg: "bg-brand-olive-soft", step: 5 },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-danger", bg: "bg-danger-soft", step: -1 },
};

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function formatDateTime(d: string) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function ocLabel(o: { purchase_order?: string | null; id: string }) { return o.purchase_order || `OC-${o.id.slice(0, 8)}`; }

export function OrdersAdmin({ orders, stats, franchises, permissions: perms, paymentPlans = [], shippingTypes = [], products = [], currentUserId = "" }: { orders: Order[]; stats: Stats; franchises: Franchise[]; permissions: Permissions; paymentPlans?: PaymentPlan[]; shippingTypes?: ShippingType[]; products?: Product[]; currentUserId?: string }) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFranchise, setFilterFranchise] = useState("");
  const [filterSeller, setFilterSeller] = useState(currentUserId ? currentUserId : "");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: new Date() });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Detail sheet
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number }[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [editPaymentPlanId, setEditPaymentPlanId] = useState("");
  const [editShippingTypeId, setEditShippingTypeId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [addProductSearch, setAddProductSearch] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const maxDate = new Date();
  const minDate = subDays(maxDate, 90);

  // Seller options from orders data
  const sellerOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => { if (o.seller_id && o.seller_name) map.set(o.seller_id, o.seller_name); });
    return [{ value: "", label: "Todos vendedores" }, ...Array.from(map, ([id, name]) => ({ value: id, label: name }))];
  }, [orders]);

  function handleDateSelect(range: DateRange | undefined) {
    if (range?.from && range?.to && differenceInDays(range.to, range.from) > 90) { toast.error("Período máximo de 90 dias"); return; }
    setDateRange(range);
    if (range?.from && range?.to) setCalendarOpen(false);
  }

  const periodLabel = useMemo(() => {
    if (!dateRange?.from) return "Selecionar período";
    const fromStr = format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
    if (!dateRange.to) return `${fromStr} até ...`;
    const isToday = format(dateRange.to, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
    return `${fromStr} até ${isToday ? "hoje" : format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
  }, [dateRange]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.franchise?.name?.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search) || o.purchase_order?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchFranchise = !filterFranchise || o.franchise?.id === filterFranchise;
    const matchSeller = !filterSeller || o.seller_id === filterSeller;
    const orderDate = new Date(o.created_at);
    const matchDateFrom = !dateRange?.from || orderDate >= dateRange.from;
    const matchDateTo = !dateRange?.to || orderDate <= endOfDay(dateRange.to);
    return matchSearch && matchStatus && matchFranchise && matchSeller && matchDateFrom && matchDateTo;
  });

  const { paginated: paginatedOrders, hasMore: hasMoreOrders, loadMore: loadMoreOrders, showing: showingOrders } = usePagination(filtered, { pageSize: 20 });

  function openDetail(order: Order) {
    setDetailOrder(order);
    setEditItems(order.items.map((i) => ({ productId: i.product_id || "", productName: i.product_name, quantity: i.quantity, unitPrice: i.unit_price })));
    setAdminNotes(order.admin_notes || "");
    setEditPaymentPlanId((order.payment_plan as PaymentPlan | null)?.id || "");
    setEditShippingTypeId((order.shipping_type as ShippingType | null)?.id || "");
    setEditNotes(order.notes || "");
    setShowAddProduct(false);
    setAddProductSearch("");
  }

  function handleSaveOrderDetails() {
    if (!detailOrder) return;
    const validItems = editItems.filter((i) => i.quantity > 0 && i.productId);
    startTransition(async () => {
      const r = await updateOrder(detailOrder.id, { notes: editNotes, adminNotes, paymentPlanId: editPaymentPlanId || null, shippingTypeId: editShippingTypeId || null, items: validItems });
      if (r?.error) toast.error(r.error);
      else toast.success("Pedido atualizado");
    });
  }

  function addProductToOrder(product: Product) {
    const segment = detailOrder?.franchise?.segment || "franquia";
    const price = product.prices.find((p) => p.segment === segment)?.price || product.prices[0]?.price || 0;
    if (editItems.some((i) => i.productId === product.id)) {
      setEditItems((prev) => prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setEditItems((prev) => [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: price }]);
    }
    setShowAddProduct(false);
    setAddProductSearch("");
  }

  const editTotal = editItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  function handleStatusChange(orderId: string, status: string) {
    if (detailOrder && detailOrder.id === orderId) setDetailOrder({ ...detailOrder, status });
    startTransition(async () => {
      const r = await updateOrderStatus(orderId, status);
      if (r?.error) { toast.error(r.error); if (detailOrder && detailOrder.id === orderId) setDetailOrder(detailOrder); }
      else toast.success(`Status → ${STATUS_CONFIG[status]?.label}`);
    });
  }

  // === Export functions ===
  function orderFullText(o: Order) {
    const pp = paymentPlans.find((p) => p.id === editPaymentPlanId) || o.payment_plan;
    const st = shippingTypes.find((s) => s.id === editShippingTypeId) || o.shipping_type;
    let t = `ORDEM DE COMPRA: ${ocLabel(o)}\n`;
    t += `Franquia: ${o.franchise?.name || "—"}\n`;
    t += `Vendedor: ${o.seller_name || "—"}\n`;
    t += `Solicitante: ${o.creator_name || "—"}\n`;
    t += `Data: ${formatDateTime(o.created_at)}\n`;
    t += `Status: ${STATUS_CONFIG[o.status]?.label || o.status}\n`;
    if (pp) t += `Pagamento: ${(pp as PaymentPlan).name}\n`;
    if (st) t += `Frete: ${(st as ShippingType).name}\n`;
    t += `\nITENS:\n`;
    o.items.forEach((item) => { t += `  ${item.product_name} — ${item.quantity}x ${formatPrice(item.unit_price)} = ${formatPrice(item.subtotal)}\n`; });
    t += `\nSubtotal: ${formatPrice(o.total)}\nRoyalties (30%): ${formatPrice(o.total * 0.3)}\nTOTAL: ${formatPrice(o.total * 1.3)}`;
    if (o.notes) t += `\n\nObs. cliente: ${o.notes}`;
    if (o.admin_notes) t += `\nObs. comercial: ${o.admin_notes}`;
    return t;
  }

  function handleExportOrder(o: Order) {
    const blob = new Blob([orderFullText(o)], { type: "text/plain" });
    const link = document.createElement("a");
    link.download = `${ocLabel(o)}-${o.franchise?.name?.replace(/\s+/g, "-").toLowerCase() || "franquia"}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  function handlePrintOrder(o: Order) {
    const pp = paymentPlans.find((p) => p.id === editPaymentPlanId) || o.payment_plan;
    const st = shippingTypes.find((s) => s.id === editShippingTypeId) || o.shipping_type;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) { toast.error("Popup bloqueado"); return; }

    const itemsRows = o.items.map((item) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;font-size:13px">${item.product_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:center;font-size:13px">${item.quantity}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:right;font-size:13px">${formatPrice(item.unit_price)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e8e8e0;text-align:right;font-size:13px;font-weight:600">${formatPrice(item.subtotal)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>${ocLabel(o)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;color:#18160f;padding:32px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #878a62}
.brand{font-size:22px;font-weight:700;color:#878a62;letter-spacing:1px}.brand small{display:block;font-size:11px;font-weight:400;color:#6b6b5e;letter-spacing:0;margin-top:2px}
.oc{text-align:right}.oc .id{font-size:11px;color:#6b6b5e;text-transform:uppercase;letter-spacing:0.5px}.oc .num{font-size:20px;font-weight:700;color:#18160f;font-family:monospace}.oc .date{font-size:12px;color:#6b6b5e;margin-top:2px}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}
.info-box label{font-size:10px;text-transform:uppercase;color:#6b6b5e;letter-spacing:0.5px;display:block;margin-bottom:2px}.info-box p{font-size:14px;font-weight:500}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
thead th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b6b5e;letter-spacing:0.5px;background:#f5f4ef;border-bottom:2px solid #e8e8e0}
thead th:nth-child(2){text-align:center}thead th:nth-child(3),thead th:nth-child(4){text-align:right}
.total-section{text-align:right;padding:4px 10px;font-size:13px;color:#4a4a3e}.total-section.grand{font-size:16px;font-weight:700;color:#18160f;padding-top:8px;border-top:2px solid #878a62;margin-top:4px}
.notes{margin-top:20px;padding:12px 16px;background:#f5f4ef;border-radius:8px;font-size:12px;color:#4a4a3e}.notes strong{display:block;font-size:10px;text-transform:uppercase;color:#6b6b5e;margin-bottom:4px;letter-spacing:0.5px}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e8e0;text-align:center;font-size:10px;color:#999}
@media print{body{padding:16px}@page{margin:12mm;size:A4}}
</style></head><body>
<div class="header">
  <div><div class="brand">EMPÓRIO ESSENZA<small>Ordem de Compra</small></div></div>
  <div class="oc"><div class="id">Ordem de Compra</div><div class="num">${ocLabel(o)}</div><div class="date">${formatDateTime(o.created_at)}</div></div>
</div>
<div class="info-grid">
  <div class="info-box"><label>Franquia</label><p>${o.franchise?.name || "—"}</p></div>
  <div class="info-box"><label>Vendedor</label><p>${o.seller_name || "—"}</p></div>
  <div class="info-box"><label>Solicitante</label><p>${o.creator_name || "—"}</p></div>
  <div class="info-box"><label>Status</label><p><span class="badge" style="background:${o.status === "pendente" ? "#fef3c7;color:#92400e" : o.status === "aprovado" ? "#dbeafe;color:#1e40af" : o.status === "confirmado" ? "#dcfce7;color:#166534" : o.status === "faturado" || o.status === "entregue" ? "#f0e8d6;color:#5a5735" : o.status === "separacao" ? "#fef3c7;color:#92400e" : o.status === "cancelado" ? "#fef2f2;color:#991b1b" : "#dbeafe;color:#1e40af"}">${STATUS_CONFIG[o.status]?.label || o.status}</span></p></div>
  <div class="info-box"><label>Pagamento</label><p>${(pp as PaymentPlan | null)?.name || "—"}</p></div>
  <div class="info-box"><label>Frete</label><p>${(st as ShippingType | null)?.name || "—"}</p></div>
</div>
<table><thead><tr><th>Produto</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${itemsRows}</tbody></table>
<div class="total-section">Subtotal produtos: ${formatPrice(o.total)}</div>
<div class="total-section">Royalties (30%): ${formatPrice(o.total * 0.3)}</div>
<div class="total-section grand">Total com Royalties: ${formatPrice(o.total * 1.3)}</div>
${o.notes ? `<div class="notes"><strong>Obs. do cliente</strong>${o.notes}</div>` : ""}
${o.admin_notes ? `<div class="notes" style="margin-top:8px"><strong>Obs. do comercial</strong>${o.admin_notes}</div>` : ""}
<div class="footer">Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — Empório Essenza Brand Hub</div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  }

  function handleExportAll() {
    const BOM = "\uFEFF";
    const sep = ";";
    const header = ["OC", "Franquia", "Vendedor", "Segmento", "Status", "Data", "Solicitante", "Pagamento", "Frete", "Produto", "Qtd", "Unitário", "Subtotal", "Total Produtos", "Royalties", "Total c/ Royalties", "Obs Cliente", "Obs Comercial"].join(sep);
    const rows: string[] = [];
    filtered.forEach((o) => {
      const base = [ocLabel(o), o.franchise?.name || "—", o.seller_name || "—", o.franchise?.segment === "multimarca_pdv" ? "Multimarca" : "Franquia", STATUS_CONFIG[o.status]?.label || o.status, formatDate(o.created_at), o.creator_name || "—", (o.payment_plan as PaymentPlan | null)?.name || "—", (o.shipping_type as ShippingType | null)?.name || "—"];
      if (o.items.length === 0) {
        rows.push([...base, "", "", "", "", formatPrice(o.total), formatPrice(o.total * 0.3), formatPrice(o.total * 1.3), (o.notes || "").replace(/;/g, ","), (o.admin_notes || "").replace(/;/g, ",")].join(sep));
      } else {
        o.items.forEach((item, idx) => {
          rows.push([...base, item.product_name.replace(/;/g, ","), String(item.quantity), formatPrice(item.unit_price), formatPrice(item.subtotal),
            idx === 0 ? formatPrice(o.total) : "", idx === 0 ? formatPrice(o.total * 0.3) : "", idx === 0 ? formatPrice(o.total * 1.3) : "",
            idx === 0 ? (o.notes || "").replace(/;/g, ",") : "", idx === 0 ? (o.admin_notes || "").replace(/;/g, ",") : "",
          ].join(sep));
        });
      }
    });
    const csv = BOM + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.download = `pedidos-essenza-${new Date().toISOString().slice(0, 10)}.csv`; link.href = URL.createObjectURL(blob); link.click();
    toast.success(`${filtered.length} pedidos exportados`);
  }

  const statusOptions = [{ value: "", label: "Todos status" }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))];
  const franchiseOptions = [{ value: "", label: "Todas franquias" }, ...franchises.map((f) => ({ value: f.id, label: f.name }))];

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

      {/* Stats */}
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

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 flex-1 min-w-0">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar OC, franquia..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none min-w-0" />
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
              <Calendar mode="range" selected={dateRange} onSelect={handleDateSelect} numberOfMonths={2} disabled={{ before: minDate, after: maxDate }} defaultMonth={dateRange?.from} />
              <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2">
                <p className="text-[10px] text-ink-400">Máx. 90 dias</p>
                <button onClick={() => { setDateRange(undefined); setCalendarOpen(false); }} className="text-xs text-ink-500 hover:text-ink-900 transition-colors">Limpar</button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-ink-400 uppercase mb-0.5 block">Status</label>
            <CustomSelect options={statusOptions} value={filterStatus} onChange={setFilterStatus} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-ink-400 uppercase mb-0.5 block">Franquia</label>
            <CustomSelect options={franchiseOptions} value={filterFranchise} onChange={setFilterFranchise} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-ink-400 uppercase mb-0.5 block">Vendedor</label>
            <CustomSelect options={sellerOptions} value={filterSeller} onChange={setFilterSeller} />
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-500 mb-3">{filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"}{dateRange?.from && <> · <span className="text-ink-700 font-medium">{periodLabel}</span></>}</p>

      {/* Table */}
      <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/30">
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">OC</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Franquia</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase hidden lg:table-cell">Vendedor</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Status</th>
              <th className="px-3 md:px-4 py-2.5 text-right text-xs font-medium text-ink-400 uppercase hidden sm:table-cell">Total</th>
              <th className="px-3 md:px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase hidden md:table-cell">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Nenhum pedido encontrado</td></tr>
            ) : paginatedOrders.map((o) => {
              const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pendente;
              const Icon = cfg.icon;
              return (
                <tr key={o.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors cursor-pointer" onClick={() => openDetail(o)}>
                  <td className="px-3 md:px-4 py-3">
                    <p className="font-mono text-[11px] font-medium text-ink-900">{ocLabel(o)}</p>
                    <p className="text-[10px] text-ink-400">{o.creator_name || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <p className="font-medium text-ink-900 text-xs truncate">{o.franchise?.name || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-ink-600">{o.seller_name || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.color)}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right font-semibold text-ink-900 text-xs hidden sm:table-cell">{formatPrice(o.total * 1.3)}</td>
                  <td className="px-3 md:px-4 py-3 hidden md:table-cell text-ink-500 text-xs">{formatDateTime(o.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMoreOrders && (
        <div className="flex justify-center mt-3">
          <button onClick={loadMoreOrders} className="rounded-lg border border-ink-200 px-5 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">Carregar mais ({showingOrders} de {filtered.length})</button>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detailOrder} onClose={() => setDetailOrder(null)} title="" wide>
        {detailOrder && (() => {
          const o = detailOrder;
          const cfg = STATUS_CONFIG[o.status];
          const currentStep = cfg.step;
          return (
            <div className="flex flex-col gap-6">
              {/* OC Header */}
              <div>
                <p className="text-[10px] text-ink-400 uppercase tracking-wider">Ordem de Compra</p>
                <p className="text-xl font-bold text-ink-900 font-mono">{ocLabel(o)}</p>
              </div>

              {/* Info cards */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                <div className="rounded-lg bg-ink-50/50 px-3 py-2.5">
                  <p className="text-[10px] text-ink-400 uppercase">Franquia</p>
                  <p className="text-sm font-medium text-ink-900 mt-0.5">{o.franchise?.name || "—"}</p>
                </div>
                <div className="rounded-lg bg-ink-50/50 px-3 py-2.5">
                  <p className="text-[10px] text-ink-400 uppercase">Vendedor</p>
                  <p className="text-sm font-medium text-ink-900 mt-0.5">{o.seller_name || "—"}</p>
                </div>
                <div className="rounded-lg bg-ink-50/50 px-3 py-2.5">
                  <p className="text-[10px] text-ink-400 uppercase">Solicitante</p>
                  <p className="text-sm font-medium text-ink-900 mt-0.5">{o.creator_name || "—"}</p>
                </div>
              </div>

              {/* Status stepper */}
              {perms.canApprove && o.status !== "cancelado" ? (
                <div>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Status</p>
                  <div className="flex items-center gap-1">
                    {STATUS_FLOW.map((s, i) => {
                      const sc = STATUS_CONFIG[s];
                      const isCurrent = o.status === s;
                      const isPast = currentStep > sc.step;
                      return (
                        <button
                          key={s}
                          onClick={() => !isCurrent && handleStatusChange(o.id, s)}
                          disabled={isPending || isCurrent}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1 rounded-lg py-2 px-1 text-[10px] font-medium transition-all border-2",
                            isCurrent ? `${sc.bg} ${sc.color} border-current shadow-sm` : isPast ? "bg-ink-50 text-ink-400 border-transparent" : "bg-white text-ink-500 border-ink-100 hover:border-ink-300"
                          )}
                        >
                          <sc.icon size={14} />
                          <span className="leading-tight">{sc.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {perms.canDelete && o.status !== "cancelado" && (
                    <button onClick={() => handleStatusChange(o.id, "cancelado")} disabled={isPending} className="flex items-center gap-1 mt-2 text-[10px] font-medium text-danger hover:text-danger/80 transition-colors">
                      <XCircle size={11} /> Cancelar pedido
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                    <cfg.icon size={12} /> {cfg.label}
                  </span>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Itens</p>
                  {perms.canEdit && (
                    <button onClick={() => setShowAddProduct(!showAddProduct)} className="flex items-center gap-1 text-xs font-medium text-brand-olive hover:text-brand-olive-dark transition-colors">
                      <Plus size={12} /> Adicionar
                    </button>
                  )}
                </div>

                {showAddProduct && perms.canEdit && (
                  <div className="mb-3 rounded-lg border border-ink-100 bg-ink-50/50 p-3">
                    <input value={addProductSearch} onChange={(e) => setAddProductSearch(e.target.value)} placeholder="Buscar produto..." autoFocus className="h-8 w-full rounded-md border border-ink-100 bg-white px-3 text-xs text-ink-900 focus:border-brand-olive focus:outline-none mb-2" />
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                      {products.filter((p) => { if (!addProductSearch) return false; const q = addProductSearch.toLowerCase(); return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q); }).slice(0, 10).map((p) => {
                        const price = p.prices.find((pr) => pr.segment === (o.franchise?.segment || "franquia"))?.price || p.prices[0]?.price || 0;
                        return (
                          <button key={p.id} onClick={() => addProductToOrder(p)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white transition-colors">
                            <span className="flex-1 text-xs text-ink-900 truncate">{p.name}</span>
                            <span className="text-xs font-medium text-ink-700">{formatPrice(price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50/30 border-b border-ink-100">
                        <th className="px-3 py-2 text-left text-xs font-medium text-ink-400">Produto</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-ink-400 w-28">Qtd</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-ink-400 w-24">Unit.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-ink-400 w-24">Subtotal</th>
                        {perms.canEdit && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`} className="border-b border-ink-50 last:border-0">
                          <td className="px-3 py-2 text-ink-900 text-xs">{item.productName}</td>
                          <td className="px-3 py-2">
                            {perms.canEdit ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setEditItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} className="flex h-6 w-6 items-center justify-center rounded border border-ink-200 text-ink-500 hover:bg-ink-50"><Minus size={10} /></button>
                                <input type="number" value={item.quantity} onChange={(e) => setEditItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, Number(e.target.value) || 1) } : it))} className="w-10 text-center text-sm font-medium text-ink-900 border border-ink-100 rounded h-6 focus:border-brand-olive focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" min={1} />
                                <button onClick={() => setEditItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))} className="flex h-6 w-6 items-center justify-center rounded border border-ink-200 text-ink-500 hover:bg-ink-50"><Plus size={10} /></button>
                              </div>
                            ) : <span className="text-center block text-sm text-ink-600">{item.quantity}</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {perms.canEdit ? (
                              <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => setEditItems((p) => p.map((it, i) => i === idx ? { ...it, unitPrice: Number(e.target.value) || 0 } : it))} className="w-20 text-right text-sm text-ink-600 border border-ink-100 rounded h-6 px-1 focus:border-brand-olive focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            ) : <span className="text-ink-600">{formatPrice(item.unitPrice)}</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-ink-900">{formatPrice(item.quantity * item.unitPrice)}</td>
                          {perms.canEdit && <td className="px-1 py-2"><button onClick={() => setEditItems((p) => p.filter((_, i) => i !== idx))} className="rounded-md p-1 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors"><Trash2 size={11} /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ink-100"><td colSpan={perms.canEdit ? 4 : 3} className="px-3 py-1.5 text-right text-xs text-ink-500">Subtotal</td><td className="px-3 py-1.5 text-right text-sm text-ink-700">{formatPrice(editTotal)}</td></tr>
                      <tr><td colSpan={perms.canEdit ? 4 : 3} className="px-3 py-1.5 text-right text-xs text-ink-500">Royalties (30%)</td><td className="px-3 py-1.5 text-right text-sm text-ink-700">{formatPrice(editTotal * 0.3)}</td></tr>
                      <tr className="bg-ink-50/30 border-t border-ink-200"><td colSpan={perms.canEdit ? 4 : 3} className="px-3 py-2.5 text-right text-sm font-semibold text-ink-700">Total</td><td className="px-3 py-2.5 text-right text-lg font-bold text-ink-900">{formatPrice(editTotal * 1.3)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Details */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] text-ink-400 uppercase mb-1 block">Pagamento</label>
                  {perms.canEdit ? (
                    <select value={editPaymentPlanId} onChange={(e) => setEditPaymentPlanId(e.target.value)} className="h-9 w-full rounded-lg border border-ink-100 bg-white px-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none">
                      <option value="">—</option>
                      {paymentPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : <p className="text-sm text-ink-900 h-9 flex items-center">{(o.payment_plan as PaymentPlan | null)?.name || "—"}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-ink-400 uppercase mb-1 block">Frete</label>
                  {perms.canEdit ? (
                    <select value={editShippingTypeId} onChange={(e) => setEditShippingTypeId(e.target.value)} className="h-9 w-full rounded-lg border border-ink-100 bg-white px-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none">
                      <option value="">—</option>
                      {shippingTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : <p className="text-sm text-ink-900 h-9 flex items-center">{(o.shipping_type as ShippingType | null)?.name || "—"}</p>}
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] text-ink-400 uppercase mb-1 block">Obs. cliente</label>
                  {perms.canEdit ? <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" /> : <p className="text-sm text-ink-600 bg-ink-50 rounded-lg px-3 py-2 min-h-[40px]">{o.notes || "—"}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-ink-400 uppercase mb-1 block">Obs. comercial</label>
                  <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-ink-100 flex-wrap">
                {perms.canEdit && (
                  <button onClick={handleSaveOrderDetails} disabled={isPending} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2.5 text-xs font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
                    <Save size={13} /> {isPending ? "Salvando..." : "Salvar alterações"}
                  </button>
                )}
                <button onClick={() => handlePrintOrder(o)} className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                  <Printer size={13} /> Imprimir
                </button>
                {perms.canExport && (
                  <>
                    <button onClick={() => handleExportOrder(o)} className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                      <Download size={13} /> TXT
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(orderFullText(o)); toast.success("Copiado"); }} className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                      <FileText size={13} /> Copiar
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
