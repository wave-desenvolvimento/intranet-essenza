"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search, Package, Check, X, Upload, FileSpreadsheet, Download } from "lucide-react";
import { createProduct, updateProduct, deleteProduct, createProductCategory, deleteProductCategory, importProducts } from "@/app/(dashboard)/novo-pedido/actions";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/use-pagination";
import { Sheet } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { uploadToStorage } from "@/lib/upload";
import { toast } from "sonner";


interface Price { id: string; segment: string; price: number }
interface ProductCategory { id: string; name: string }
interface Product {
  id: string; name: string; sku: string | null; category: string | null; category_id: string | null;
  unit: string; min_qty: number; active: boolean; image_url: string | null;
  stock_status: string; pre_order_date: string | null; prices: Price[];
  product_category: ProductCategory | null;
}

const STOCK_OPTIONS = [
  { value: "in_stock", label: "Em estoque" },
  { value: "out_of_stock", label: "Sem estoque" },
  { value: "pre_order", label: "Pré-venda" },
];

const UNIT_OPTIONS = [
  { value: "un", label: "Unidade" }, { value: "cx", label: "Caixa" },
  { value: "kg", label: "Kg" }, { value: "L", label: "Litro" },
  { value: "pct", label: "Pacote" }, { value: "dz", label: "Dúzia" },
];

const inputCls = "h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function ProductsManager({ products, categories }: { products: Product[]; categories: ProductCategory[] }) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { confirm, dialogProps } = useConfirm();

  // Sheet
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [unit, setUnit] = useState("un");
  const [minQty, setMinQty] = useState("1");
  const [active, setActive] = useState(true);
  const [priceFranquia, setPriceFranquia] = useState("");
  const [pricePdv, setPricePdv] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [stockStatus, setStockStatus] = useState("in_stock");
  const [preOrderDate, setPreOrderDate] = useState("");

  // CSV Import
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [csvRows, setCsvRows] = useState<{ name: string; sku: string; category: string; unit: string; minQty: number; priceFranquia: number; pricePdv: number; stockStatus: string }[]>([]);
  const [importError, setImportError] = useState("");

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)
  );

  const { paginated: paginatedProducts, hasMore, loadMore, showing, total: totalFiltered } = usePagination(filtered, { pageSize: 15 });


  function openCreate() {
    setEditing(null); setName(""); setSku(""); setCategoryId(""); setUnit("un");
    setMinQty("1"); setActive(true); setPriceFranquia(""); setPricePdv(""); setImageUrl("");
    setStockStatus("in_stock"); setPreOrderDate("");
    setError(""); setShowSheet(true);
  }

  function openEdit(p: Product) {
    setEditing(p); setName(p.name); setSku(p.sku || ""); setCategoryId(p.category_id || "");
    setUnit(p.unit); setMinQty(String(p.min_qty)); setActive(p.active);
    setPriceFranquia(String(p.prices.find((pr) => pr.segment === "franquia")?.price || ""));
    setPricePdv(String(p.prices.find((pr) => pr.segment === "multimarca_pdv")?.price || ""));
    setImageUrl(p.image_url || "");
    setStockStatus(p.stock_status || "in_stock"); setPreOrderDate(p.pre_order_date || "");
    setError(""); setShowSheet(true);
  }

  function handleSave() {
    const fd = new FormData();
    const catName = categories.find((c) => c.id === categoryId)?.name || "";
    fd.set("name", name); fd.set("sku", sku); fd.set("category", catName); fd.set("categoryId", categoryId);
    fd.set("unit", unit); fd.set("minQty", minQty); fd.set("active", String(active));
    fd.set("priceFranquia", priceFranquia); fd.set("pricePdv", pricePdv);
    fd.set("imageUrl", imageUrl);
    fd.set("stockStatus", stockStatus); fd.set("preOrderDate", preOrderDate);
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updateProduct(fd); r?.error ? setError(r.error) : setShowSheet(false); });
    } else {
      startTransition(async () => { const r = await createProduct(fd); r?.error ? setError(r.error) : setShowSheet(false); });
    }
  }

  function handleDownloadTemplate() {
    const BOM = "\uFEFF";
    const header = "Nome;SKU;Categoria;Unidade;Qtd Mínima;Preço Franquia;Preço Multimarca;Status Estoque";
    const example = "Essência Lavanda 100ml;ESS-LAV-100;Essências;un;1;45.90;52.00;in_stock";
    const csv = BOM + header + "\n" + example + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.download = "template-produtos-essenza.csv";
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  function handleCsvFile(file: File) {
    setImportError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { setImportError("Arquivo vazio"); return; }

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setImportError("Arquivo precisa ter cabeçalho + ao menos 1 linha"); return; }

      // Skip header
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(";").map((c) => c.trim());
        return {
          name: cols[0] || "",
          sku: cols[1] || "",
          category: cols[2] || "",
          unit: cols[3] || "un",
          minQty: Number(cols[4]) || 1,
          priceFranquia: Number(cols[5]?.replace(",", ".")) || 0,
          pricePdv: Number(cols[6]?.replace(",", ".")) || 0,
          stockStatus: cols[7] || "in_stock",
        };
      }).filter((r) => r.name);

      if (rows.length === 0) { setImportError("Nenhum produto válido encontrado"); return; }
      setCsvRows(rows);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (csvRows.length === 0) return;
    startTransition(async () => {
      const r = await importProducts(csvRows) as { error?: string; imported?: number; skipped?: number };
      if (r?.error) { setImportError(r.error); return; }
      toast.success(`${r.imported || 0} produtos importados${r.skipped ? `, ${r.skipped} ignorados` : ""}`);
      setShowImportSheet(false);
      setCsvRows([]);
    });
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: "Remover produto", message: "Tem certeza? Produtos vinculados a pedidos não podem ser removidos.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteProduct(id); if (r?.error) setError(r.error); });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Produtos</h1>
          <p className="text-sm text-ink-500">{products.length} produtos · {products.filter((p) => p.active).length} ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setCsvRows([]); setImportError(""); setShowImportSheet(true); }} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            <FileSpreadsheet size={14} /> <span className="hidden sm:inline">Importar CSV</span>
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            <Plus size={16} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 max-w-xs mb-4">
        <Search size={14} className="text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou SKU..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Produto</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">SKU</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase">Categoria</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">Franquia</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-400 uppercase">PDV/Multi</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-ink-400 uppercase">Un.</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-ink-400 uppercase">Status</th>
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p) => {
              const pFranquia = p.prices.find((pr) => pr.segment === "franquia");
              const pPdv = p.prices.find((pr) => pr.segment === "multimarca_pdv");
              return (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                          <Package size={14} className="text-ink-400" />
                        </div>
                      )}
                      <span className="font-medium text-ink-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-500 font-mono text-xs">{p.sku || "—"}</td>
                  <td className="px-4 py-3 text-ink-500">{(p.product_category as unknown as ProductCategory)?.name || p.category || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink-900">{pFranquia ? formatPrice(pFranquia.price) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink-900">{pPdv ? formatPrice(pPdv.price) : "—"}</td>
                  <td className="px-4 py-3 text-center text-ink-500">{p.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", p.active ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500")}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                      {p.stock_status !== "in_stock" && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", p.stock_status === "pre_order" ? "bg-info-soft text-info" : "bg-danger-soft text-danger")}>
                          {p.stock_status === "pre_order" ? "Pré-venda" : "Sem estoque"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(p.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400">Nenhum produto</td></tr>}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center mt-3">
          <button onClick={loadMore} className="rounded-lg border border-ink-200 px-5 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            Carregar mais ({showing} de {totalFiltered})
          </button>
        </div>
      )}

      <Sheet open={showSheet} onClose={() => setShowSheet(false)} onSubmit={handleSave} title={editing ? "Editar Produto" : "Novo Produto"} wide>
        <div className="flex flex-col gap-4">
          {/* Image */}
          <div className="flex items-center gap-4">
            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover border border-ink-100" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute -top-1.5 -right-1.5 rounded-full bg-ink-700 p-0.5 text-white hover:bg-danger"><X size={10} /></button>
              </div>
            ) : (
              <label className={cn("flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors shrink-0", uploadingImg ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive")}>
                <input type="file" accept="image/*" className="sr-only" disabled={uploadingImg} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploadingImg(true); const r = await uploadToStorage(f, { bucket: "assets", folder: "products" }); setUploadingImg(false); if ("url" in r) setImageUrl(r.url); }} />
                {uploadingImg ? <span className="text-[9px] text-brand-olive">...</span> : <Upload size={18} className="text-ink-400" />}
              </label>
            )}
            <p className="text-[10px] text-ink-400">Imagem do produto<br />Quadrada, mín. 200x200px</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputCls} placeholder="Essência Lavanda 100ml" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={cn(inputCls, "font-mono")} placeholder="ESS-LAV-100" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Categoria</label>
              <CustomSelect
                options={[{ value: "", label: "Sem categoria" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Selecione..."
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="h-7 flex-1 rounded-md border border-ink-100 bg-white px-2 text-xs text-ink-900 focus:border-brand-olive focus:outline-none" placeholder="Nova categoria..." />
                <button type="button" disabled={!newCatName.trim() || isPending} onClick={async () => { const r = await createProductCategory(newCatName.trim()); if (!r?.error) setNewCatName(""); }} className="rounded-md bg-ink-50 px-2 h-7 text-[10px] font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-40">
                  <Plus size={10} className="inline mr-0.5" />Criar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Unidade</label>
                <CustomSelect options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Qtd mín.</label>
                <input type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} min={1} className={inputCls} />
              </div>
            </div>
          </div>

          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Preços por Segmento</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Franquia (R$)</label>
                <input type="number" step="0.01" value={priceFranquia} onChange={(e) => setPriceFranquia(e.target.value)} className={inputCls} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Multimarca / PDV (R$)</label>
                <input type="number" step="0.01" value={pricePdv} onChange={(e) => setPricePdv(e.target.value)} className={inputCls} placeholder="0,00" />
              </div>
            </div>
          </fieldset>

          {/* Disponibilidade */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Disponibilidade</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Status do estoque</label>
                <CustomSelect options={STOCK_OPTIONS} value={stockStatus} onChange={setStockStatus} />
              </div>
              {stockStatus === "pre_order" && (
                <div>
                  <label className="text-xs font-medium text-ink-700 mb-1 block">Disponível em</label>
                  <input type="date" value={preOrderDate} onChange={(e) => setPreOrderDate(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer mt-3">
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px]", active ? "border-brand-olive bg-brand-olive" : "border-ink-300")} onClick={() => setActive(!active)}>
                  {active && <Check size={9} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm text-ink-700">Produto ativo</span>
              </label>
            )}
          </fieldset>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !name} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}</button>
            <button onClick={() => setShowSheet(false)} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>
      {/* Import CSV Sheet */}
      <Sheet open={showImportSheet} onClose={() => setShowImportSheet(false)} title="Importar Produtos por CSV" wide>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className={cn("flex items-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors", csvRows.length > 0 ? "border-brand-olive bg-brand-olive-soft/20" : "border-ink-200 hover:border-brand-olive")}>
              <input type="file" accept=".csv,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              <Upload size={16} className="text-ink-500" />
              <span className="text-sm text-ink-700">{csvRows.length > 0 ? `${csvRows.length} produtos carregados` : "Selecionar arquivo CSV"}</span>
            </label>
            <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 text-xs text-brand-olive hover:text-brand-olive-dark transition-colors">
              <Download size={12} /> Baixar template
            </button>
          </div>

          <p className="text-[10px] text-ink-400">
            Formato: <code className="bg-ink-50 px-1 py-0.5 rounded">Nome;SKU;Categoria;Unidade;Qtd Mínima;Preço Franquia;Preço Multimarca;Status Estoque</code>
            <br />Separador: ponto e vírgula (;). Status: in_stock, out_of_stock, pre_order
          </p>

          {importError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{importError}</p>}

          {csvRows.length > 0 && (
            <>
              <div className="rounded-xl border border-ink-100 overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-ink-50 border-b border-ink-100">
                      <th className="px-3 py-2 text-left font-medium text-ink-400">#</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-400">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-400">SKU</th>
                      <th className="px-3 py-2 text-left font-medium text-ink-400">Categoria</th>
                      <th className="px-3 py-2 text-center font-medium text-ink-400">Un.</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-400">Franquia</th>
                      <th className="px-3 py-2 text-right font-medium text-ink-400">Multi/PDV</th>
                      <th className="px-3 py-2 text-center font-medium text-ink-400">Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className="border-b border-ink-50 last:border-0">
                        <td className="px-3 py-1.5 text-ink-400">{i + 1}</td>
                        <td className="px-3 py-1.5 text-ink-900 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5 text-ink-500 font-mono">{row.sku || "—"}</td>
                        <td className="px-3 py-1.5 text-ink-500">{row.category || "—"}</td>
                        <td className="px-3 py-1.5 text-center text-ink-500">{row.unit}</td>
                        <td className="px-3 py-1.5 text-right text-ink-600">{row.priceFranquia > 0 ? formatPrice(row.priceFranquia) : "—"}</td>
                        <td className="px-3 py-1.5 text-right text-ink-600">{row.pricePdv > 0 ? formatPrice(row.pricePdv) : "—"}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                            row.stockStatus === "in_stock" ? "bg-success-soft text-success" :
                            row.stockStatus === "pre_order" ? "bg-info-soft text-info" : "bg-danger-soft text-danger"
                          )}>
                            {row.stockStatus === "in_stock" ? "Estoque" : row.stockStatus === "pre_order" ? "Pré-venda" : "Sem estoque"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 pt-2 border-t border-ink-100">
                <button onClick={handleImport} disabled={isPending} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">
                  {isPending ? "Importando..." : `Importar ${csvRows.length} produtos`}
                </button>
                <button onClick={() => setShowImportSheet(false)} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
              </div>
            </>
          )}
        </div>
      </Sheet>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
