"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ShoppingCart, Plus, Minus, Trash2, Send, Package, Search,
  FileText, Clock, CheckCircle, XCircle, ArrowRight, CalendarDays,
  ZoomIn, X as XIcon, ChevronLeft, ChevronRight as ChevronRightIcon, Filter,
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
interface Order { id: string; status: string; total: number; notes: string | null; purchase_order: string | null; created_at: string; items: OrderItem[] }

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
  enviado: Send, confirmado: CheckCircle, separacao: Clock, faturado: FileText, entregue: CheckCircle, cancelado: XCircle, rascunho: Clock,
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado", separacao: "Em Separação", faturado: "Faturado", entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  enviado: "bg-info-soft text-info", confirmado: "bg-success-soft text-success",
  separacao: "bg-warning-soft text-warning",
  faturado: "bg-brand-olive-soft text-brand-olive", entregue: "bg-brand-olive-soft text-brand-olive",
  cancelado: "bg-danger-soft text-danger", rascunho: "bg-ink-100 text-ink-500",
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
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const categories = [...new Set(products.map((p) => (p as unknown as { product_category?: { name: string } }).product_category?.name || p.category).filter(Boolean))].sort() as string[];

  function toggleCategory(cat: string) {
    setFilterCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const catName = (p as unknown as { product_category?: { name: string } }).product_category?.name || p.category;
    const matchCategory = filterCategories.length === 0 || (catName && filterCategories.includes(catName));
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
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
                  <Search size={14} className="text-ink-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou SKU..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
                </div>
                {categories.length > 0 && (
                  <button onClick={() => setShowCategoryFilter(!showCategoryFilter)} className={cn("flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition-colors shrink-0", filterCategories.length > 0 ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-ink-100 bg-white text-ink-600 hover:border-ink-200")}>
                    <Filter size={13} />
                    {filterCategories.length > 0 ? `${filterCategories.length} categorias` : "Categorias"}
                  </button>
                )}
              </div>
              {showCategoryFilter && (
                <div className="rounded-lg border border-ink-100 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-ink-400 uppercase font-medium">Filtrar por categoria</p>
                    {filterCategories.length > 0 && (
                      <button onClick={() => setFilterCategories([])} className="text-[10px] text-ink-500 hover:text-ink-900 transition-colors">Limpar</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const isActive = filterCategories.includes(c);
                      return (
                        <button key={c} onClick={() => toggleCategory(c)} className={cn("rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border", isActive ? "border-brand-olive bg-brand-olive text-white" : "border-ink-100 bg-ink-50/50 text-ink-600 hover:border-ink-200")}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
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
                      <div className="relative group/img shrink-0">
                        <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); const allImgs = [p.image_url!, ...((p as unknown as { images?: string[] }).images || [])].filter(Boolean); setLightbox({ urls: allImgs, index: 0 }); }} className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover/img:bg-black/30 transition-colors">
                          <ZoomIn size={12} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                        </button>
                      </div>
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-500">Subtotal produtos</span>
                      <span className="text-sm text-ink-700">{formatPrice(cartTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-ink-500">Royalties (30%)</span>
                      <span className="text-sm text-ink-700">{formatPrice(cartTotal * 0.3)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-ink-100 mb-3">
                      <span className="text-sm font-medium text-ink-700">Total</span>
                      <span className="text-xl font-bold text-ink-900">{formatPrice(cartTotal * 1.3)}</span>
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
                      <p className="text-sm font-medium text-ink-900">{order.purchase_order || `Pedido #${order.id.slice(0, 8)}`}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", STATUS_COLOR[order.status])}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-400">{formatDate(order.created_at)} · {order.items.length} {order.items.length === 1 ? "item" : "itens"}</p>
                  </div>
                  <span className="text-sm font-bold text-ink-900 shrink-0">{formatPrice(order.total * 1.3)}</span>
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
                    <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-ink-50 text-[10px]">
                      <div className="flex justify-between text-ink-400"><span>Subtotal produtos</span><span>{formatPrice(order.total)}</span></div>
                      <div className="flex justify-between text-ink-400"><span>Royalties (30%)</span><span>{formatPrice(order.total * 0.3)}</span></div>
                      <div className="flex justify-between font-medium text-ink-700 pt-1 border-t border-ink-50"><span>Total</span><span>{formatPrice(order.total * 1.3)}</span></div>
                    </div>
                    {order.notes && <p className="text-[10px] text-ink-400 mt-2 pt-2 border-t border-ink-50">Obs: {order.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"><XIcon size={20} /></button>
          <img src={lightbox.urls[lightbox.index]} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          {lightbox.urls.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.urls.length) % lightbox.urls.length }); }} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.urls.length }); }} className="absolute right-16 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"><ChevronRightIcon size={20} /></button>
              <div className="absolute bottom-4 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {lightbox.urls.map((_, i) => (
                  <button key={i} onClick={() => setLightbox({ ...lightbox, index: i })} className={cn("h-2 w-2 rounded-full transition-colors", i === lightbox.index ? "bg-white" : "bg-white/40")} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
