"use client";

import { useState, useTransition } from "react";
import { Package, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { updateStock, initializeStock } from "../stock-actions";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface StockItem { [key: string]: any; }

interface Props {
  franchiseId: string;
  stock: StockItem[];
  canEdit: boolean;
}

export function StockTab({ franchiseId, stock, canEdit }: Props) {
  const [items, setItems] = useState(stock);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editMin, setEditMin] = useState(0);

  const lowCount = items.filter((s) => s.quantity <= s.min_quantity && s.min_quantity > 0).length;

  const filtered = items.filter((s) => {
    const product = s.product as { name: string; sku: string; category: string };
    const matchSearch = !search || product.name.toLowerCase().includes(search.toLowerCase()) || product.sku.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (s.quantity <= s.min_quantity && s.min_quantity > 0);
    return matchSearch && matchFilter;
  });

  function startEdit(s: StockItem) {
    setEditingId(s.id);
    setEditQty(s.quantity);
    setEditMin(s.min_quantity);
  }

  function cancelEdit() { setEditingId(null); }

  function saveEdit(productId: string) {
    startTransition(async () => {
      const r = await updateStock(franchiseId, productId, editQty, editMin);
      if (r.success) {
        setItems((prev) => prev.map((s) =>
          s.product_id === productId ? { ...s, quantity: editQty, min_quantity: editMin } : s
        ));
        setEditingId(null);
      }
    });
  }

  function handleInit() {
    startTransition(async () => {
      const r = await initializeStock(franchiseId);
      if (r && "added" in r && r.added && r.added > 0) {
        window.location.reload();
      }
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1 min-w-[200px]">
            <Search size={14} className="text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1">
            <button onClick={() => setFilter("all")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", filter === "all" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>Todos ({items.length})</button>
            <button onClick={() => setFilter("low")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", filter === "low" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
              Estoque baixo {lowCount > 0 && <span className="ml-1 rounded-full bg-danger text-white text-[10px] px-1.5">{lowCount}</span>}
            </button>
          </div>
        </div>
        {canEdit && items.length === 0 && (
          <button onClick={handleInit} disabled={isPending} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors disabled:opacity-50">
            <RefreshCw size={14} /> Inicializar Estoque
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-12">
          <Package size={28} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">{items.length === 0 ? "Estoque não inicializado" : "Nenhum produto encontrado"}</p>
          {items.length === 0 && canEdit && (
            <button onClick={handleInit} disabled={isPending} className="mt-2 text-sm font-medium text-brand-olive">{isPending ? "Inicializando..." : "Inicializar com todos os produtos"}</button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="px-4 py-3 text-left font-medium text-ink-500">Produto</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500 hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Qtd</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Mínimo</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Status</th>
                {canEdit && <th className="px-4 py-3 text-right font-medium text-ink-500 w-24">Ação</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const product = s.product as { id: string; name: string; sku: string; category: string };
                const isLow = s.quantity <= s.min_quantity && s.min_quantity > 0;
                const isEditing = editingId === s.id;

                return (
                  <tr key={s.id} className={cn("border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors", isLow && "bg-danger-soft/30")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle size={13} className="text-danger shrink-0" />}
                        <span className="font-medium text-ink-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-500 hidden sm:table-cell font-mono text-xs">{product.sku}</td>
                    <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{product.category || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input type="number" value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} className="h-8 w-20 rounded-md border border-ink-200 px-2 text-sm text-right" min={0} />
                      ) : (
                        <span className={cn("font-semibold", isLow ? "text-danger" : "text-ink-900")}>{s.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input type="number" value={editMin} onChange={(e) => setEditMin(Number(e.target.value))} className="h-8 w-20 rounded-md border border-ink-200 px-2 text-sm text-right" min={0} />
                      ) : (
                        <span className="text-ink-500">{s.min_quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isLow ? (
                        <span className="inline-flex rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-medium text-danger">Baixo</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">OK</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => saveEdit(s.product_id)} disabled={isPending} className="rounded-md px-2 py-1 text-[11px] font-medium bg-brand-olive text-white hover:bg-brand-olive-dark disabled:opacity-50">Salvar</button>
                            <button onClick={cancelEdit} className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-500 hover:bg-ink-100">×</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(s)} className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-100 transition-colors">Editar</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
