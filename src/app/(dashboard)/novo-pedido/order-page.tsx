"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ShoppingCart, Plus, Minus, Trash2, Send, Package, Search,
  FileText, Clock, CheckCircle, XCircle, ArrowRight, CalendarDays,
} from "lucide-react";
import { createOrder } from "./actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { usePagination } from "@/hooks/use-pagination";
import { format, startOfMonth, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import Link from "next/link";

interface Price { segment: string; price: number }
interface Product { id: string; name: string; sku: string | null; category: string | null; unit: string; min_qty: number; image_url: string | null; stock_status: string; pre_order_date: string | null; prices: Price[] }
interface OrderItem { product_name: string; quantity: number; unit_price: number; subtotal: number }
interface Order { id: string; status: string; total: number; notes: string | null; created_at: string; items: OrderItem[] }

interface CartItem { productId: string; productName: string; quantity: number; unitPrice: number; unit: string }

interface Props {
  products: Product[];
  orders: Order[];
  segment: string;
  franchiseName: string;
  franchiseId: string;
  isAdmin: boolean;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  enviado: Send, confirmado: CheckCircle, faturado: FileText, cancelado: XCircle, rascunho: Clock,
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado", faturado: "Faturado", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  enviado: "bg-info-soft text-info", confirmado: "bg-success-soft text-success",
  faturado: "bg-brand-olive-soft text-brand-olive", cancelado: "bg-danger-soft text-danger",
  rascunho: "bg-ink-100 text-ink-500",
};

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function OrderPage({ products, orders, segment, franchiseName, franchiseId, isAdmin }: Props) {
  const [tab, setTab] = useState<"new" | "history">("new");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: new Date() });
  const [historyCalendarOpen, setHistoryCalendarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const categories = [...new Set(products.map((p) => (p as unknown as { product_category?: { name: string } }).product_category?.name || p.category).filter(Boolean))] as string[];

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const catName = (p as unknown as { product_category?: { name: string } }).product_category?.name || p.category;
    const matchCategory = !filterCategory || catName === filterCategory;
    return matchSearch && matchCategory;
  });

  const { paginated: paginatedProducts, hasMore, loadMore, showing, total: totalFiltered } = usePagination(filteredProducts, { pageSize: 15 });

  function getPrice(product: Product) {
    return product.prices.find((p) => p.segment === segment)?.price || 0;
  }

  function addToCart(product: Product) {
    const price = getPrice(product);
    if (!price) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + product.min_qty } : i);
      return [...prev, { productId: product.id, productName: product.name, quantity: product.min_qty, unitPrice: price, unit: product.unit }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(0, i.quantity + delta);
      return { ...i, quantity: newQty };
    }).filter((i) => i.quantity > 0));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  function handleSubmit() {
    if (cart.length === 0) return;
    const fd = new FormData();
    fd.set("items", JSON.stringify(cart));
    fd.set("notes", notes);
    startTransition(async () => {
      const r = await createOrder(fd);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Pedido enviado com sucesso!");
      setCart([]);
      setNotes("");
      setTab("history");
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Novo Pedido</h1>
          <p className="text-sm text-ink-500">{franchiseName} · Tabela {segment === "franquia" ? "Franquia" : "Multimarca/PDV"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1 self-start mb-5 w-fit">
        <button onClick={() => setTab("new")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === "new" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700")}>
          <ShoppingCart size={13} className="inline mr-1.5" /> Novo Pedido
        </button>
        <button onClick={() => setTab("history")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === "history" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700")}>
          <Clock size={13} className="inline mr-1.5" /> Histórico ({orders.length})
        </button>
      </div>

      {tab === "new" && (
        <div>
          {/* Product catalog — full width */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
                <Search size={14} className="text-ink-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
              </div>
              {categories.length > 0 && (
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                  <button onClick={() => setFilterCategory("")} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition-colors", !filterCategory ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}>Todos</button>
                  {categories.map((c) => (
                    <button key={c} onClick={() => setFilterCategory(c)} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition-colors", filterCategory === c ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}>{c}</button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-ink-400 mb-2">{showing} de {totalFiltered} produtos</p>
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
              {paginatedProducts.map((p, i) => {
                const price = getPrice(p);
                const inCart = cart.find((c) => c.productId === p.id);
                return (
                  <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 transition-colors", i < paginatedProducts.length - 1 && "border-b border-ink-50")}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                        <Package size={16} className="text-ink-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900">{p.name}</p>
                      <p className="text-[10px] text-ink-400">{p.sku && `${p.sku} · `}{p.unit}{p.min_qty > 1 ? ` · mín. ${p.min_qty}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-sm font-semibold text-ink-900">{price ? formatPrice(price) : "—"}</span>
                      {p.stock_status === "pre_order" && (
                        <span className="rounded-full bg-info-soft px-1.5 py-0.5 text-[8px] font-medium text-info">Pré-venda{p.pre_order_date ? ` · ${new Date(p.pre_order_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span>
                      )}
                      {p.stock_status === "out_of_stock" && (
                        <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[8px] font-medium text-danger">Sem estoque</span>
                      )}
                    </div>
                    {price > 0 && p.stock_status !== "out_of_stock" && (
                      inCart ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(p.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"><Minus size={12} /></button>
                          <span className="w-8 text-center text-sm font-medium text-ink-900">{inCart.quantity}</span>
                          <button onClick={() => updateQty(p.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"><Plus size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p)} className="flex items-center gap-1 rounded-lg bg-brand-olive-soft px-3 py-1.5 text-[11px] font-medium text-brand-olive hover:bg-brand-olive/10 transition-colors shrink-0">
                          <Plus size={12} /> Adicionar
                        </button>
                      )
                    )}
                  </div>
                );
              })}
              {filteredProducts.length === 0 && <p className="text-center text-sm text-ink-400 py-8">Nenhum produto encontrado</p>}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-3">
                <button onClick={loadMore} className="rounded-lg border border-ink-200 px-5 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                  Carregar mais
                </button>
              </div>
            )}
          </div>

          {/* Cart — floating button + Sheet */}
          {cart.length > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              className="fixed bottom-20 right-4 md:bottom-6 md:right-8 z-40 flex items-center gap-2 rounded-2xl bg-brand-olive px-5 py-3 text-sm font-medium text-white shadow-xl hover:bg-brand-olive-dark transition-colors"
            >
              <ShoppingCart size={16} />
              <span>{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
              <span className="text-white/70">·</span>
              <span className="font-bold">{formatPrice(cartTotal)}</span>
            </button>
          )}
          <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={`Carrinho (${cart.length})`}>
            <div className="flex flex-col gap-3">
              {cart.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-8">Nenhum item adicionado</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{item.productName}</p>
                          <p className="text-xs text-ink-400">{item.quantity} {item.unit} × {formatPrice(item.unitPrice)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item.productId, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"><Minus size={12} /></button>
                          <span className="w-8 text-center text-sm font-medium text-ink-900">{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"><Plus size={12} /></button>
                        </div>
                        <span className="text-sm font-semibold text-ink-900 shrink-0 w-20 text-right">{formatPrice(item.quantity * item.unitPrice)}</span>
                        <button onClick={() => removeFromCart(item.productId)} className="rounded-md p-1 text-ink-400 hover:text-danger shrink-0"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-ink-100 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-ink-700">Total</span>
                      <span className="text-xl font-bold text-ink-900">{formatPrice(cartTotal)}</span>
                    </div>

                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações do pedido..."
                      rows={2}
                      className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none mb-3"
                    />

                    <button
                      onClick={handleSubmit}
                      disabled={isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-olive px-4 py-3 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
                    >
                      <Send size={14} /> {isPending ? "Enviando..." : "Enviar Pedido"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </Sheet>
        </div>
      )}

      {tab === "history" && (() => {
        const filteredOrders = orders.filter((o) => {
          const d = new Date(o.created_at);
          if (historyDateRange?.from && d < historyDateRange.from) return false;
          if (historyDateRange?.to && d > endOfDay(historyDateRange.to)) return false;
          return true;
        });
        const periodLabel = historyDateRange?.from
          ? `${format(historyDateRange.from, "dd/MM", { locale: ptBR })} até ${historyDateRange.to ? (format(historyDateRange.to, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "hoje" : format(historyDateRange.to, "dd/MM", { locale: ptBR })) : "..."}`
          : "Todo período";

        return (
        <div className="space-y-3">
          {/* Period filter */}
          <div className="flex items-center justify-between">
            <Popover open={historyCalendarOpen} onOpenChange={setHistoryCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 text-sm text-ink-600 hover:border-ink-200 transition-colors">
                  <CalendarDays size={14} />
                  <span>{periodLabel}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={historyDateRange} onSelect={(range) => { setHistoryDateRange(range); if (range?.from && range?.to) setHistoryCalendarOpen(false); }} numberOfMonths={2} defaultMonth={historyDateRange?.from} />
                <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2">
                  <p className="text-[10px] text-ink-400">{filteredOrders.length} pedidos</p>
                  <button onClick={() => { setHistoryDateRange(undefined); setHistoryCalendarOpen(false); }} className="text-xs text-ink-500 hover:text-ink-900">Limpar</button>
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-ink-500">{filteredOrders.length} pedidos · {formatPrice(filteredOrders.reduce((s, o) => s + o.total, 0))}</p>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-12 text-center">
              <Clock size={28} className="text-ink-300 mx-auto mb-2" />
              <p className="text-sm text-ink-400">Nenhum pedido no período</p>
            </div>
          ) : filteredOrders.map((order) => {
            const Icon = STATUS_ICON[order.status] || Clock;
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)} className="flex items-center gap-4 w-full px-5 py-4 text-left hover:bg-ink-50/50 transition-colors">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", STATUS_COLOR[order.status]?.split(" ")[0] || "bg-ink-100")}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">Pedido #{order.id.slice(0, 8)}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", STATUS_COLOR[order.status])}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-400">{formatDate(order.created_at)} · {order.items.length} {order.items.length === 1 ? "item" : "itens"}</p>
                  </div>
                  <span className="text-sm font-bold text-ink-900 shrink-0">{formatPrice(order.total)}</span>
                  <ArrowRight size={14} className={cn("text-ink-400 transition-transform shrink-0", isExpanded && "rotate-90")} />
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-ink-50">
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-ink-400">
                          <th className="text-left py-1">Produto</th>
                          <th className="text-right py-1">Qtd</th>
                          <th className="text-right py-1">Unitário</th>
                          <th className="text-right py-1">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, i) => (
                          <tr key={i} className="border-t border-ink-50">
                            <td className="py-1.5 text-ink-900">{item.product_name}</td>
                            <td className="py-1.5 text-right text-ink-600">{item.quantity}</td>
                            <td className="py-1.5 text-right text-ink-600">{formatPrice(item.unit_price)}</td>
                            <td className="py-1.5 text-right font-medium text-ink-900">{formatPrice(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {order.notes && <p className="text-[10px] text-ink-400 mt-2 pt-2 border-t border-ink-50">Obs: {order.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}
