"use client";

import { useState } from "react";
import {
  Search, X, ZoomIn, Download, Eye, FileText, File, Image as ImageIcon,
  Filter, Grid3X3, List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFile, downloadFilesAsZip } from "@/lib/download";
import { ImageFormatDownload, type ImageVariant } from "@/components/ui/image-format-download";
import { ShareLink } from "@/components/ui/share-link";
import { usePagination } from "@/hooks/use-pagination";
import Link from "next/link";

interface Asset {
  id: string;
  itemId: string;
  title: string;
  collection: string;
  collectionSlug: string;
  pageSlug: string;
  type: "image" | "file";
  url: string;
  label: string;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

interface Props {
  assets: Asset[];
  canDownload: boolean;
}

function getFileExt(url: string) {
  const match = url.match(/\.(\w{2,5})(?:\?|$)/);
  return match ? match[1].toUpperCase() : "FILE";
}

function isImageUrl(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext);
}

const EXT_COLORS: Record<string, string> = {
  PDF: "bg-red-50 text-red-600",
  DOC: "bg-blue-50 text-blue-600", DOCX: "bg-blue-50 text-blue-600",
  XLS: "bg-green-50 text-green-600", XLSX: "bg-green-50 text-green-600",
  PPT: "bg-orange-50 text-orange-600", PPTX: "bg-orange-50 text-orange-600",
  ZIP: "bg-yellow-50 text-yellow-700",
  MP4: "bg-purple-50 text-purple-600", MP3: "bg-purple-50 text-purple-600",
};

export function BibliotecaContent({ assets, canDownload }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "file">("all");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [lightbox, setLightbox] = useState<{ url: string } | null>(null);

  const collections = [...new Set(assets.map((a) => a.collection))].sort();
  const now = new Date();

  const filtered = assets.filter((a) => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (collectionFilter && a.collection !== collectionFilter) return false;
    if (statusFilter === "active" && a.expiresAt && new Date(a.expiresAt) < now) return false;
    if (statusFilter === "expired" && (!a.expiresAt || new Date(a.expiresAt) >= now)) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.collection.toLowerCase().includes(q) || a.label.toLowerCase().includes(q);
    }
    return true;
  });

  const { paginated, hasMore, loadMore, showing, total } = usePagination(filtered, { pageSize: 40 });

  const imageCount = assets.filter((a) => a.type === "image").length;
  const fileCount = assets.filter((a) => a.type === "file").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Biblioteca</h1>
          <p className="text-sm text-ink-500">{assets.length} assets · {imageCount} imagens · {fileCount} arquivos</p>
        </div>
        {canDownload && filtered.length > 0 && (
          <button
            onClick={() => downloadFilesAsZip(filtered.map((a) => ({ url: a.url, filename: `${a.title}.${a.url.split("?")[0].split(".").pop() || "file"}` })), "biblioteca-essenza.zip")}
            className="flex items-center gap-2 rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors self-start"
          >
            <Download size={14} /> Baixar tudo ({filtered.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar assets..."
            className="h-9 w-full rounded-lg border border-ink-100 bg-white pl-9 pr-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter */}
          <div className="flex items-center rounded-lg border border-ink-100 bg-white overflow-hidden">
            {([
              { value: "all", label: "Todos" },
              { value: "image", label: "Imagens" },
              { value: "file", label: "Arquivos" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  typeFilter === opt.value ? "bg-brand-olive text-white" : "text-ink-600 hover:bg-ink-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-lg border border-ink-100 bg-white overflow-hidden">
            {([
              { value: "all", label: "Todos" },
              { value: "active", label: "Vigentes" },
              { value: "expired", label: "Expirados" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === opt.value ? "bg-brand-olive text-white" : "text-ink-600 hover:bg-ink-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Collection filter */}
          <select
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="h-9 rounded-lg border border-ink-100 bg-white px-3 pr-8 text-sm text-ink-700 focus:border-brand-olive focus:outline-none"
          >
            <option value="">Todas as coleções</option>
            {collections.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-ink-100 bg-white overflow-hidden">
            <button onClick={() => setView("grid")} className={cn("p-1.5 transition-colors", view === "grid" ? "bg-ink-100 text-ink-700" : "text-ink-400 hover:bg-ink-50")}>
              <Grid3X3 size={14} />
            </button>
            <button onClick={() => setView("list")} className={cn("p-1.5 transition-colors", view === "list" ? "bg-ink-100 text-ink-700" : "text-ink-400 hover:bg-ink-50")}>
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Results info */}
      {search || typeFilter !== "all" || collectionFilter ? (
        <p className="text-xs text-ink-400">{total} resultado{total !== 1 ? "s" : ""}</p>
      ) : null}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <ImageIcon size={32} className="text-ink-300 mb-3" />
          <p className="text-sm text-ink-400">Nenhum asset encontrado</p>
        </div>
      ) : view === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginated.map((a) => {
            const isImage = a.type === "image" && isImageUrl(a.url);
            const ext = getFileExt(a.url);
            const extColor = EXT_COLORS[ext] || "bg-ink-100 text-ink-600";
            const isExpired = a.expiresAt && new Date(a.expiresAt) < now;

            return (
              <div key={a.id} className={cn("rounded-xl border bg-white overflow-hidden hover:border-ink-200 transition-colors group", isExpired ? "border-danger/30 opacity-70" : "border-ink-100")}>
                {/* Thumbnail */}
                <div
                  className={cn(
                    "relative aspect-square cursor-pointer",
                    isImage ? "bg-ink-900" : "bg-ink-50 flex items-center justify-center"
                  )}
                  onClick={() => isImage ? setLightbox({ url: a.url }) : window.open(a.url, "_blank")}
                >
                  {isImage ? (
                    <>
                      <img src={a.url} alt={a.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-75 transition-opacity" loading="lazy" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="rounded-full bg-white/90 p-2.5 shadow-md">
                          <ZoomIn size={16} className="text-ink-700" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", extColor)}>
                      {ext === "PDF" ? <FileText size={24} /> : <File size={24} />}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="px-3 pt-2 pb-1.5">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-ink-900 truncate flex-1">{a.title}</p>
                    {isExpired && <span className="shrink-0 rounded-full bg-danger-soft px-1.5 py-0.5 text-[8px] font-medium text-danger">Expirado</span>}
                  </div>
                  <p className="text-[10px] text-ink-400 truncate">
                    {a.collection}
                    {a.expiresAt && !isExpired && <> · Expira {new Date(a.expiresAt).toLocaleDateString("pt-BR")}</>}
                  </p>
                </div>

                {/* Actions */}
                <div className="px-3 pb-2.5 flex items-center gap-1">
                  {isImage && (
                    <button onClick={() => setLightbox({ url: a.url })} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">
                      <ZoomIn size={10} /> Ver
                    </button>
                  )}
                  {canDownload && (
                    <button onClick={() => downloadFile(a.url, a.title)} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">
                      <Download size={10} /> Baixar
                    </button>
                  )}
                  <div className="flex-1" />
                  {a.pageSlug && (
                    <Link href={`/pagina/${a.pageSlug}`} className="rounded-md p-1 text-ink-300 hover:text-brand-olive transition-colors" title="Ir para página">
                      <Eye size={11} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="rounded-xl border border-ink-100 bg-white overflow-hidden divide-y divide-ink-50">
          {paginated.map((a) => {
            const isImage = a.type === "image" && isImageUrl(a.url);
            const ext = getFileExt(a.url);
            const extColor = EXT_COLORS[ext] || "bg-ink-100 text-ink-600";
            const isExpired = a.expiresAt && new Date(a.expiresAt) < now;

            return (
              <div key={a.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 transition-colors", isExpired && "opacity-70")}>
                {/* Thumbnail */}
                {isImage ? (
                  <div className="h-12 w-12 rounded-lg overflow-hidden bg-ink-900 shrink-0 cursor-pointer" onClick={() => setLightbox({ url: a.url })}>
                    <img src={a.url} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", extColor)}>
                    {ext === "PDF" ? <FileText size={18} /> : <File size={18} />}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-ink-900 truncate">{a.title}</p>
                    {isExpired && <span className="shrink-0 rounded-full bg-danger-soft px-1.5 py-0.5 text-[8px] font-medium text-danger">Expirado</span>}
                  </div>
                  <p className="text-[10px] text-ink-400">
                    {a.collection} · {ext} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    {a.expiresAt && !isExpired && <> · Expira {new Date(a.expiresAt).toLocaleDateString("pt-BR")}</>}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isImage && (
                    <button onClick={() => setLightbox({ url: a.url })} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Ampliar">
                      <ZoomIn size={14} />
                    </button>
                  )}
                  {!isImage && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Abrir">
                      <Eye size={14} />
                    </a>
                  )}
                  {canDownload && (
                    <button onClick={() => downloadFile(a.url, a.title)} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Baixar">
                      <Download size={14} />
                    </button>
                  )}
                  {a.pageSlug && (
                    <Link href={`/pagina/${a.pageSlug}`} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Ir para página">
                      <Eye size={14} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <button onClick={loadMore} className="rounded-lg border border-ink-100 px-6 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors">
            Carregar mais ({showing} de {total})
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
          <img src={lightbox.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          {canDownload && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => downloadFile(lightbox.url)} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors flex items-center gap-1.5">
                <Download size={13} /> Baixar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
