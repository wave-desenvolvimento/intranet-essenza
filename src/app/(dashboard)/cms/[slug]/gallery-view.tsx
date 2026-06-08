"use client";

import { useState, useTransition, useEffect } from "react";
import { Image as ImageIcon, Pencil, Trash2, X, ZoomIn, Copy, Download, Eye, FileText, File, Share2, Link2, Check, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageFormatDownload, type ImageVariant } from "@/components/ui/image-format-download";
import { getIconComponent } from "@/components/ui/icon-picker";
import { BrandLogo } from "@/components/layout/brand-logo";
import { downloadFile, downloadFilesAsZip } from "@/lib/download";
import { createShareLink, createBulkShareLink } from "@/app/(dashboard)/cms/share-action";
import { toast } from "sonner";

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
  options?: unknown;
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

interface DetailField {
  name: string;
  raw: unknown;
  type: string;
  options?: unknown;
}

type ModalSection =
  | { kind: "images"; name: string; images: ImageVariant[] }
  | { kind: "files"; name: string; files: { title: string; url: string }[] }
  | { kind: "detail"; detail: DetailField };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 rounded-md p-1 text-ink-300 hover:text-brand-olive hover:bg-ink-50 transition-colors"
      title="Copiar"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function DetailFieldRenderer({ detail }: { detail: DetailField }) {
  const { name, raw, type } = detail;

  function formatDate(v: unknown, withTime: boolean) {
    try {
      return new Date(String(v)).toLocaleDateString("pt-BR", withTime ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return String(v); }
  }

  function plainText(html: string) {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  switch (type) {
    case "rich_text": {
      const html = String(raw);
      return (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2.5">
          <div className="text-sm text-ink-800 prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: html }} />
          <CopyButton text={plainText(html)} />
        </div>
      );
    }
    case "text":
      return <p className="text-sm text-ink-800">{String(raw)}</p>;
    case "textarea": {
      const text = String(raw);
      return (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2.5">
          <p className="text-sm text-ink-800 whitespace-pre-wrap">{text}</p>
          <CopyButton text={text} />
        </div>
      );
    }
    case "number":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-800 font-mono">{String(raw)}</p>
          <CopyButton text={String(raw)} />
        </div>
      );
    case "url": {
      const url = String(raw);
      return (
        <div className="flex items-center justify-between gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-olive hover:underline break-all">{url}</a>
          <CopyButton text={url} />
        </div>
      );
    }
    case "email": {
      const email = String(raw);
      return (
        <div className="flex items-center justify-between gap-2">
          <a href={`mailto:${email}`} className="text-sm text-brand-olive hover:underline">{email}</a>
          <CopyButton text={email} />
        </div>
      );
    }
    case "color": {
      const color = String(raw);
      return (
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md border border-ink-100 shrink-0" style={{ background: color }} />
          <span className="text-sm text-ink-800 font-mono">{color}</span>
          <CopyButton text={color} />
        </div>
      );
    }
    case "boolean":
      return <p className="text-sm text-ink-800">{raw ? "Sim" : "Não"}</p>;
    case "date":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-800">{formatDate(raw, false)}</p>
          <CopyButton text={formatDate(raw, false)} />
        </div>
      );
    case "datetime":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-800">{formatDate(raw, true)}</p>
          <CopyButton text={formatDate(raw, true)} />
        </div>
      );
    case "duration": {
      const dur = String(raw);
      return (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-ink-400 shrink-0" />
          <p className="text-sm text-ink-800 font-mono">{dur}</p>
          <CopyButton text={dur} />
        </div>
      );
    }
    case "select": {
      const val = String(raw);
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-700">{val}</span>
          <CopyButton text={val} />
        </div>
      );
    }
    case "multi_select": {
      const items = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      return (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {items.map((v, i) => (
              <span key={i} className="inline-block rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-700">{v}</span>
            ))}
          </div>
          <CopyButton text={items.join(", ")} />
        </div>
      );
    }
    case "icon_select": {
      const iconName = String(raw);
      const IconComp = getIconComponent(iconName);
      return (
        <div className="flex items-center gap-2">
          {IconComp ? <IconComp size={18} className="text-ink-600" /> : <span className="text-sm text-ink-400">?</span>}
          <span className="text-sm text-ink-800">{iconName}</span>
        </div>
      );
    }
    case "collection_ref": {
      const refId = String(raw);
      return <p className="text-sm text-ink-500 font-mono truncate">{refId}</p>;
    }
    case "collection_multi_ref": {
      const refIds = Array.isArray(raw) ? raw.map(String) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {refIds.map((id, i) => (
            <span key={i} className="inline-block rounded bg-ink-50 px-2 py-0.5 text-[11px] font-mono text-ink-600">{id.slice(0, 8)}</span>
          ))}
        </div>
      );
    }
    default: {
      const fallback = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      return (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-ink-800 break-all">{fallback}</p>
          <CopyButton text={fallback} />
        </div>
      );
    }
  }
}

function ShareButton({ url, size = 12, className }: { url: string; size?: number; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleShare() {
    setLoading(true);
    const result = await createShareLink(url, 86400);
    setLoading(false);
    if (result.url) {
      await navigator.clipboard.writeText(result.url);
      setDone(true);
      toast.success("Link copiado!");
      setTimeout(() => setDone(false), 2000);
    } else {
      toast.error("Erro ao gerar link");
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleShare(); }}
      disabled={loading}
      className={cn("rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors", size <= 11 && "rounded p-1 text-white/70 hover:text-white", className)}
      title="Copiar link compartilhável"
    >
      {loading ? <Loader2 size={size} className="animate-spin" /> : done ? <Check size={size} /> : <Link2 size={size} />}
    </button>
  );
}

function BulkShareButton({ items }: { items: { url: string; label: string; type: "image" | "file" }[] }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleBulkShare() {
    setLoading(true);
    const result = await createBulkShareLink(items);
    setLoading(false);
    if (result.url) {
      await navigator.clipboard.writeText(result.url);
      setDone(true);
      toast.success("Link copiado!");
      setTimeout(() => setDone(false), 2000);
    } else {
      toast.error("Erro ao gerar link");
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleBulkShare(); }}
      disabled={loading}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-ink-500 hover:text-brand-olive hover:bg-ink-50 transition-colors"
      title="Compartilhar tudo"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : done ? <><Check size={11} /> Copiado</> : <><Link2 size={11} /> Compartilhar tudo</>}
    </button>
  );
}

export function GalleryView({ items, fields, onEdit, onDelete, onDuplicate, isPending }: Props) {
  const [lightbox, setLightbox] = useState<{ url: string; variants: ImageVariant[] } | null>(null);
  const [contentModal, setContentModal] = useState<{ title: string; images: ImageVariant[]; files: { title: string; url: string }[]; details: DetailField[]; sections: ModalSection[] } | null>(null);

  const imageFields = fields.filter((f) => f.field_type === "image");
  const variantsFields = fields.filter((f) => f.field_type === "image_variants");
  const imageArrayFields = fields.filter((f) => f.field_type === "image_array");
  const titleField = fields.find((f) => f.field_type === "text");
  const tagsField = fields.find((f) => f.slug === "tags");
  const descField = fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");
  const fileFields = fields.filter((f) => f.field_type === "file");
  const fileArrayFields = fields.filter((f) => f.field_type === "file_array");

  const mediaTypes = new Set(["image", "image_variants", "image_array", "file", "file_array"]);
  const detailFields = fields.filter((f) => !mediaTypes.has(f.field_type));

  const hasImageSchema = imageFields.length > 0 || variantsFields.length > 0 || imageArrayFields.length > 0;
  const hasFileSchema = fileFields.length > 0 || fileArrayFields.length > 0;

  if (!hasImageSchema && !hasFileSchema) {
    return <p className="text-sm text-ink-400 text-center py-8">Esta collection precisa de um campo do tipo Imagem ou Arquivo</p>;
  }

  function getItemImages(item: Item): ImageVariant[] {
    const images: ImageVariant[] = [];
    for (const f of imageFields) {
      const url = String(item.data[f.slug] || "");
      if (url) images.push({ label: f.name, url });
    }
    for (const f of variantsFields) {
      const data = item.data[f.slug] as Record<string, string> | undefined;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const [label, url] of Object.entries(data)) {
          if (url) images.push({ label, url });
        }
      }
    }
    for (const f of imageArrayFields) {
      const arr = Array.isArray(item.data[f.slug]) ? item.data[f.slug] as { url: string; title?: string }[] : [];
      arr.forEach((img, i) => { if (img.url) images.push({ label: img.title || `${f.name} ${i + 1}`, url: img.url }); });
    }
    return images;
  }

  function getItemFiles(item: Item): { title: string; url: string }[] {
    const files: { title: string; url: string }[] = [];
    for (const f of fileArrayFields) {
      const arr = Array.isArray(item.data[f.slug]) ? (item.data[f.slug] as { title?: string; url: string }[]) : [];
      arr.forEach((file) => { if (file.url) files.push({ title: file.title || f.name, url: file.url }); });
    }
    for (const f of fileFields) {
      const url = String(item.data[f.slug] || "");
      if (url) files.push({ title: titleField ? String(item.data[titleField.slug] || f.name) : f.name, url });
    }
    return files;
  }

  function getItemDetails(item: Item): DetailField[] {
    const details: DetailField[] = [];
    for (const f of detailFields) {
      const raw = item.data[f.slug];
      if (raw == null || raw === "" || raw === false || (Array.isArray(raw) && raw.length === 0)) continue;
      // For booleans, only skip if false (already filtered above)
      details.push({ name: f.name, raw, type: f.field_type, options: f.options });
    }
    return details;
  }

  function buildSections(item: Item): ModalSection[] {
    const sections: ModalSection[] = [];
    for (const f of fields) {
      const raw = item.data[f.slug];
      if (raw == null || raw === "" || raw === false) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;

      if (f.field_type === "image") {
        const url = String(raw);
        if (url) sections.push({ kind: "images", name: f.name, images: [{ label: f.name, url }] });
      } else if (f.field_type === "image_variants") {
        const data = raw as Record<string, string> | undefined;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const imgs = Object.entries(data).filter(([, url]) => url).map(([label, url]) => ({ label, url }));
          if (imgs.length) sections.push({ kind: "images", name: f.name, images: imgs });
        }
      } else if (f.field_type === "image_array") {
        const arr = Array.isArray(raw) ? (raw as { url: string; title?: string }[]) : [];
        const imgs = arr.filter((a) => a.url).map((a, i) => ({ label: a.title || `${f.name} ${i + 1}`, url: a.url }));
        if (imgs.length) sections.push({ kind: "images", name: f.name, images: imgs });
      } else if (f.field_type === "file") {
        const url = String(raw);
        if (url) sections.push({ kind: "files", name: f.name, files: [{ title: f.name, url }] });
      } else if (f.field_type === "file_array") {
        const arr = Array.isArray(raw) ? (raw as { title?: string; url: string }[]) : [];
        const fls = arr.filter((a) => a.url).map((a) => ({ title: a.title || f.name, url: a.url }));
        if (fls.length) sections.push({ kind: "files", name: f.name, files: fls });
      } else {
        sections.push({ kind: "detail", detail: { name: f.name, raw, type: f.field_type, options: f.options } });
      }
    }
    return sections;
  }

  function handleCardClick(item: Item) {
    const images = getItemImages(item);
    const files = getItemFiles(item);
    const details = getItemDetails(item);
    const sections = buildSections(item);
    const title = titleField ? String(item.data[titleField.slug] || "") : "";

    // Nothing to show
    if (sections.length === 0) return;

    // Single image only → lightbox
    if (images.length === 1 && files.length === 0 && details.length === 0) {
      setLightbox({ url: images[0].url, variants: images });
      return;
    }

    // Single file only → open directly
    if (images.length === 0 && files.length === 1 && details.length === 0) {
      window.open(files[0].url, "_blank");
      return;
    }

    // Open content modal
    setContentModal({ title, images, files, details, sections });
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const safeStr = (v: unknown) => (v == null || typeof v === "object" ? "" : String(v));
          const title = titleField ? safeStr(item.data[titleField.slug]) : "";
          const tags = tagsField ? safeStr(item.data[tagsField.slug]) : "";
          const rawDesc = descField ? safeStr(item.data[descField.slug]) : "";
          const descText = rawDesc.replace(/<[^>]*>/g, "").trim();
          const images = getItemImages(item);
          const files = getItemFiles(item);
          const imgUrl = images[0]?.url || "";

          // Decide what to show in the thumbnail
          const showImage = !!imgUrl;
          const showFile = !imgUrl && files.length > 0;
          const totalMedia = images.length + files.length;

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
                {totalMedia > 1 && (
                  <span className="absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white flex items-center gap-1">
                    {images.length > 0 && <><ImageIcon size={9} /> {images.length}</>}
                    {images.length > 0 && files.length > 0 && <span className="mx-0.5">+</span>}
                    {files.length > 0 && <><File size={9} /> {files.length}</>}
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
                {totalMedia > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCardClick(item); }}
                    className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors"
                  >
                    {imgUrl ? <ZoomIn size={11} /> : <Eye size={11} />}
                    {totalMedia === 1 ? (imgUrl ? "Ver" : "Abrir") : `Ver ${totalMedia} itens`}
                  </button>
                )}
                {imgUrl && images.length <= 1 && (
                  <ImageFormatDownload imageUrl={imgUrl} variants={images} />
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

      {/* Image Lightbox — z-[250] to render above content modal */}
      {lightbox && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
          <img src={lightbox.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-lg bg-white">
              <ImageFormatDownload imageUrl={lightbox.url} variants={lightbox.variants} />
            </div>
            <ShareButton url={lightbox.url} />
          </div>
        </div>
      )}

      {/* Content Modal (images + files) */}
      {contentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={() => setContentModal(null)}>
          <div className="w-full max-w-lg max-h-[85vh] rounded-xl bg-white shadow-modal overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 shrink-0">
              <h3 className="text-base font-semibold text-ink-900">{contentModal.title || "Conteúdo"}</h3>
              <button onClick={() => setContentModal(null)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto">
              {/* Bulk actions header */}
              {(contentModal.images.length > 1 || contentModal.files.length > 1) && (
                <div className="flex items-center justify-end gap-1 -mb-2">
                  {(contentModal.images.length + contentModal.files.length) > 1 && (
                    <BulkShareButton items={[
                      ...contentModal.images.map((img) => ({ url: img.url, label: img.label, type: "image" as const })),
                      ...contentModal.files.map((f) => ({ url: f.url, label: f.title, type: "file" as const })),
                    ]} />
                  )}
                  {(contentModal.images.length + contentModal.files.length) > 1 && (
                    <button
                      onClick={() => downloadFilesAsZip([
                        ...contentModal.images.map((img, i) => ({ url: img.url, filename: `${img.label || `imagem-${i + 1}`}.${img.url.split(".").pop()?.split("?")[0] || "jpg"}` })),
                        ...contentModal.files.map((f) => ({ url: f.url, filename: `${f.title}.${f.url.split(".").pop()?.split("?")[0] || "file"}` })),
                      ], `${contentModal.title || "download"}.zip`)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-ink-500 hover:text-brand-olive hover:bg-ink-50 transition-colors"
                    >
                      <Download size={11} /> Baixar tudo
                    </button>
                  )}
                </div>
              )}
              {/* Sections in field order */}
              {contentModal.sections.map((section, si) => {
                if (section.kind === "images") return (
                  <div key={si} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-ink-700">{section.name} ({section.images.length})</p>
                    <div className="grid grid-cols-2 gap-3">
                      {section.images.map((img, i) => (
                        <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-ink-900 group">
                          <img src={img.url} alt={img.label} className="w-full h-full object-cover opacity-90 group-hover:opacity-70 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setLightbox({ url: img.url, variants: contentModal.images })}
                              className="rounded-full bg-white/90 p-3 text-ink-700 hover:bg-white transition-colors shadow-md"
                            >
                              <ZoomIn size={18} />
                            </button>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2 flex items-end justify-between">
                            <span className="text-[11px] text-white truncate flex-1 mr-2 font-medium">{img.label}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <ShareButton url={img.url} size={13} className="rounded-md p-1.5 text-white/80 hover:text-white hover:bg-white/20" />
                              <button onClick={(e) => { e.stopPropagation(); downloadFile(img.url, img.label); }} className="rounded-md p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors" title="Baixar">
                                <Download size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                if (section.kind === "files") return (
                  <div key={si} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-ink-700">{section.name} ({section.files.length})</p>
                    {section.files.map((file, i) => {
                      const ext = getFileExt(file.url);
                      const extColor = EXT_COLORS[ext] || "bg-ink-100 text-ink-600";
                      const isImg = isImageExt(file.url);
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-ink-100 px-4 py-3 hover:bg-ink-50 transition-colors">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", extColor)}>
                            {isImg ? <ImageIcon size={18} /> : ext === "PDF" ? <FileText size={18} /> : <File size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{file.title}</p>
                            <p className="text-[10px] text-ink-400">{ext}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <ShareButton url={file.url} size={14} />
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Abrir">
                              <Eye size={14} />
                            </a>
                            <button onClick={() => downloadFile(file.url, file.title)} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Baixar">
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
                if (section.kind === "detail") return (
                  <div key={si} className="px-1">
                    <p className="text-xs font-semibold text-ink-700 mb-1.5">{section.detail.name}</p>
                    <DetailFieldRenderer detail={section.detail} />
                  </div>
                );
                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
