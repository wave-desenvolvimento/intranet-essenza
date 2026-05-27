"use client";

import { useState } from "react";
import { Image as ImageIcon, Pencil, Trash2, X, ZoomIn, Copy, Download, Eye, FileText, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageFormatDownload, type ImageVariant } from "@/components/ui/image-format-download";
import { BrandLogo } from "@/components/layout/brand-logo";

interface Item {
  id: string;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
}

interface Field {
  slug: string;
  name: string;
  field_type: string;
}

interface Props {
  items: Item[];
  fields: Field[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  isPending: boolean;
}

function getFileExt(url: string) {
  const match = url.match(/\.(\w{2,5})(?:\?|$)/);
  return match ? match[1].toUpperCase() : "FILE";
}

function isImageExt(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext);
}

const EXT_COLORS: Record<string, string> = {
  PDF: "bg-red-50 text-red-600",
  DOC: "bg-blue-50 text-blue-600",
  DOCX: "bg-blue-50 text-blue-600",
  XLS: "bg-green-50 text-green-600",
  XLSX: "bg-green-50 text-green-600",
  PPT: "bg-orange-50 text-orange-600",
  PPTX: "bg-orange-50 text-orange-600",
  ZIP: "bg-yellow-50 text-yellow-700",
  MP4: "bg-purple-50 text-purple-600",
  MP3: "bg-purple-50 text-purple-600",
};

export function GalleryView({ items, fields, onEdit, onDelete, onDuplicate, isPending }: Props) {
  const [lightbox, setLightbox] = useState<{ url: string; variants: ImageVariant[] } | null>(null);
  const [fileModal, setFileModal] = useState<{ title: string; files: { title: string; url: string }[] } | null>(null);

  const imageField = fields.find((f) => f.field_type === "image");
  const variantsField = fields.find((f) => f.field_type === "image_variants");
  const titleField = fields.find((f) => f.field_type === "text");
  const tagsField = fields.find((f) => f.slug === "tags");
  const descField = fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");
  const fileField = fields.find((f) => f.field_type === "file");
  const fileArrayField = fields.find((f) => f.field_type === "file_array");

  const hasImages = imageField || variantsField;
  const hasFiles = fileField || fileArrayField;

  if (!hasImages && !hasFiles) {
    return <p className="text-sm text-ink-400 text-center py-8">Esta collection precisa de um campo do tipo Imagem ou Arquivo</p>;
  }

  function getItemFiles(item: Item): { title: string; url: string }[] {
    if (fileArrayField) {
      const arr = Array.isArray(item.data[fileArrayField.slug]) ? (item.data[fileArrayField.slug] as { title?: string; url: string }[]) : [];
      return arr.map((f) => ({ title: f.title || "Arquivo", url: f.url }));
    }
    if (fileField) {
      const url = String(item.data[fileField.slug] || "");
      if (url) return [{ title: titleField ? String(item.data[titleField.slug] || "Arquivo") : "Arquivo", url }];
    }
    return [];
  }

  function handleCardClick(item: Item) {
    if (hasImages) {
      // Image mode: open lightbox with first image
      const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
      const variants: ImageVariant[] = variantsData
        ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
        : [];
      const imgUrl = (imageField ? String(item.data[imageField.slug] || "") : "") || variants[0]?.url || "";
      if (imgUrl) setLightbox({ url: imgUrl, variants });
    } else {
      // File mode: open file modal
      const title = titleField ? String(item.data[titleField.slug] || "") : "";
      const files = getItemFiles(item);
      if (files.length === 1) {
        window.open(files[0].url, "_blank");
      } else if (files.length > 1) {
        setFileModal({ title, files });
      }
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const safeStr = (v: unknown) => (v == null || typeof v === "object" ? "" : String(v));
          const title = titleField ? safeStr(item.data[titleField.slug]) : "";
          const tags = tagsField ? safeStr(item.data[tagsField.slug]) : "";
          const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
          const variants: ImageVariant[] = variantsData && typeof variantsData === "object" && !Array.isArray(variantsData)
            ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
            : [];
          const imgUrl = (imageField ? safeStr(item.data[imageField.slug]) : "") || variants[0]?.url || "";
          const rawDesc = descField ? safeStr(item.data[descField.slug]) : "";
          const descText = rawDesc.replace(/<[^>]*>/g, "").trim();
          const files = getItemFiles(item);
          const firstFileUrl = files[0]?.url || "";
          const firstExt = firstFileUrl ? getFileExt(firstFileUrl) : "";

          // Decide what to show in the thumbnail
          const showImage = hasImages && imgUrl;
          const showFile = !hasImages && hasFiles;

          return (
            <div key={item.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden hover:border-ink-200 transition-colors">
              {/* Thumbnail */}
              <div
                className={cn(
                  "relative cursor-pointer",
                  showImage ? "aspect-square bg-ink-50" : "aspect-[4/3] bg-brand-olive-soft/60 flex flex-col items-center justify-center"
                )}
                onClick={() => handleCardClick(item)}
              >
                {showImage ? (
                  <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
                ) : showFile ? (
                  <>
                    <BrandLogo width={148} height={148} />
                    {files.length > 1 && (
                      <span className="absolute top-2 right-2 rounded-md bg-brand-olive/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
                        {files.length} arquivos
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-ink-300 text-xs">Sem conteúdo</div>
                )}
                {item.status !== "published" && (
                  <span className="absolute top-2 left-2 rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-medium text-warning">
                    Rascunho
                  </span>
                )}
                {hasImages && variants.length > 0 && (
                  <span className="absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white flex items-center gap-1">
                    <ImageIcon size={9} /> {variants.length}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="px-3 pt-2.5 pb-2">
                {title && <p className="text-sm font-medium text-ink-900 truncate leading-snug">{title}</p>}
                {descText && <p className="text-[11px] text-ink-400 truncate mt-0.5 leading-snug">{descText}</p>}
                {tags && <p className="text-[10px] text-ink-400 truncate mt-0.5">{tags}</p>}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex items-center gap-1">
                {showImage && imgUrl && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setLightbox({ url: imgUrl, variants }); }} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">
                      <ZoomIn size={11} /> Ver
                    </button>
                    <ImageFormatDownload imageUrl={imgUrl} variants={variants} />
                  </>
                )}
                {showFile && files.length > 0 && (
                  <button
                    onClick={() => handleCardClick(item)}
                    className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors"
                  >
                    <Eye size={11} /> {files.length === 1 ? "Abrir" : `Ver ${files.length} arquivos`}
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => onEdit(item)} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={12} /></button>
                {onDuplicate && <button onClick={() => onDuplicate(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={12} /></button>}
                <button onClick={() => onDelete(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
          <img src={lightbox.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 right-4 rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <ImageFormatDownload imageUrl={lightbox.url} variants={lightbox.variants} />
          </div>
        </div>
      )}

      {/* File Modal */}
      {fileModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={() => setFileModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
              <h3 className="text-base font-semibold text-ink-900">{fileModal.title || "Arquivos"}</h3>
              <button onClick={() => setFileModal(null)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {fileModal.files.map((file, i) => {
                const ext = getFileExt(file.url);
                const extColor = EXT_COLORS[ext] || "bg-ink-100 text-ink-600";
                const isImg = isImageExt(file.url);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-ink-100 px-4 py-3 hover:bg-ink-50 transition-colors group"
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", extColor)}>
                      {isImg ? <ImageIcon size={18} /> : ext === "PDF" ? <FileText size={18} /> : <File size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{file.title}</p>
                      <p className="text-[10px] text-ink-400">{ext}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Abrir">
                        <Eye size={14} />
                      </a>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" download className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Baixar">
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
