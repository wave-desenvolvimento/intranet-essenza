"use client";

import { useState } from "react";
import { Image as ImageIcon, Pencil, Trash2, X, ZoomIn, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageFormatDownload, type ImageVariant } from "@/components/ui/image-format-download";

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

export function GalleryView({ items, fields, onEdit, onDelete, onDuplicate, isPending }: Props) {
  const [lightbox, setLightbox] = useState<{ url: string; variants: ImageVariant[] } | null>(null);

  // Find image and title fields
  const imageField = fields.find((f) => f.field_type === "image");
  const variantsField = fields.find((f) => f.field_type === "image_variants");
  const titleField = fields.find((f) => f.field_type === "text");
  const tagsField = fields.find((f) => f.slug === "tags");

  const descField = fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");

  if (!imageField && !variantsField) {
    return <p className="text-sm text-ink-400 text-center py-8">Esta collection precisa de um campo do tipo Imagem</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const title = titleField ? String(item.data[titleField.slug] || "") : "";
          const tags = tagsField ? String(item.data[tagsField.slug] || "") : "";
          const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
          const variants: ImageVariant[] = variantsData
            ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
            : [];
          const imgUrl = (imageField ? String(item.data[imageField.slug] || "") : "") || variants[0]?.url || "";
          const rawDesc = descField ? String(item.data[descField.slug] || "") : "";
          const descText = rawDesc.replace(/<[^>]*>/g, "").trim();

          return (
            <div key={item.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden hover:border-ink-200 transition-colors">
              {/* Image */}
              <div
                className="relative aspect-square bg-ink-50 cursor-pointer"
                onClick={() => imgUrl && setLightbox({ url: imgUrl, variants })}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-ink-300 text-xs">Sem imagem</div>
                )}
                {item.status !== "published" && (
                  <span className="absolute top-2 left-2 rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-medium text-warning">
                    Rascunho
                  </span>
                )}
                {variants.length > 0 && (
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
                {imgUrl && (
                  <button onClick={(e) => { e.stopPropagation(); setLightbox({ url: imgUrl, variants }); }} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">
                    <ZoomIn size={11} /> Ver
                  </button>
                )}
                {imgUrl && <ImageFormatDownload imageUrl={imgUrl} variants={variants} />}
                <div className="flex-1" />
                <button onClick={() => onEdit(item)} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={12} /></button>
                {onDuplicate && <button onClick={() => onDuplicate(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={12} /></button>}
                <button onClick={() => onDelete(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-8"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 right-4 rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <ImageFormatDownload imageUrl={lightbox.url} variants={lightbox.variants} />
          </div>
        </div>
      )}
    </>
  );
}
