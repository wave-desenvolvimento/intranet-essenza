"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Check, Image, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLibraryAssets, type LibraryAsset } from "@/app/(dashboard)/biblioteca/actions";

interface LibraryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (items: { url: string; title: string }[]) => void;
  multiple?: boolean;
  accept?: "image" | "file" | "all";
}

function isImageUrl(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext);
}

let cachedAssets: LibraryAsset[] | null = null;

export function LibraryPicker({ open, onClose, onSelect, multiple = false, accept = "all" }: LibraryPickerProps) {
  const [assets, setAssets] = useState<LibraryAsset[]>(cachedAssets || []);
  const [loading, setLoading] = useState(!cachedAssets);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (cachedAssets) { setAssets(cachedAssets); setLoading(false); return; }
    setLoading(true);
    const data = await getLibraryAssets();
    cachedAssets = data;
    setAssets(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) { load(); setSelected(new Set()); setSearch(""); }
  }, [open, load]);

  if (!open) return null;

  const filtered = assets.filter((a) => {
    if (accept === "image" && a.type !== "image") return false;
    if (accept === "file" && a.type !== "file") return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.collection.toLowerCase().includes(q);
    }
    return true;
  });

  function toggle(id: string) {
    if (multiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  }

  function confirm() {
    const items = assets
      .filter((a) => selected.has(a.id))
      .map((a) => ({ url: a.url, title: a.title }));
    if (items.length > 0) onSelect(items);
    onClose();
  }

  function handleQuickSelect(asset: LibraryAsset) {
    if (!multiple) {
      onSelect([{ url: asset.url, title: asset.title }]);
      onClose();
    } else {
      toggle(asset.id);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-3" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] rounded-xl bg-white shadow-modal flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
          <h3 className="text-sm font-semibold text-ink-900">Escolher da biblioteca</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"><X size={16} /></button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-ink-50">
          <Search size={14} className="text-ink-400 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por titulo, colecao..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
          {search && <button onClick={() => setSearch("")} className="text-ink-400 hover:text-ink-700"><X size={12} /></button>}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && <p className="text-center text-sm text-ink-400 py-8">Carregando...</p>}
          {!loading && filtered.length === 0 && <p className="text-center text-sm text-ink-400 py-8">Nenhum arquivo encontrado</p>}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {filtered.map((a) => {
                const isImg = isImageUrl(a.url);
                const isSelected = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => handleQuickSelect(a)}
                    className={cn(
                      "relative rounded-lg border overflow-hidden transition-all text-left group",
                      isSelected ? "border-brand-olive ring-2 ring-brand-olive/30" : "border-ink-100 hover:border-ink-300"
                    )}
                  >
                    <div className="aspect-square bg-ink-50 flex items-center justify-center">
                      {isImg ? (
                        <img src={a.url} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <FileText size={20} className="text-ink-300" />
                          <span className="text-[9px] font-medium text-ink-400 uppercase">{a.url.split("?")[0].split(".").pop()}</span>
                        </div>
                      )}
                    </div>
                    <p className="px-1.5 py-1 text-[10px] text-ink-700 truncate">{a.title}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-olive text-white">
                        <Check size={10} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {multiple && selected.size > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100">
            <span className="text-xs text-ink-500">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
            <button onClick={confirm} className="rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
