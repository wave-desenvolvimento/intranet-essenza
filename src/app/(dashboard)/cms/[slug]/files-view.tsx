"use client";

import { Download, FileText, Eye, Pencil, Trash2, File, Image, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

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

function getFileIcon(url: string) {
  if (!url) return File;
  const ext = url.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext || "")) return Image;
  if (ext === "pdf") return FileText;
  return File;
}

function getFileName(url: string) {
  if (!url) return "—";
  return decodeURIComponent(url.split("/").pop() || "arquivo");
}

function formatSize(url: string) {
  // Can't get real size from URL alone, placeholder
  return "";
}

export function FilesView({ items, fields, onEdit, onDelete, onDuplicate, isPending }: Props) {
  const titleField = fields.find((f) => f.field_type === "text");
  const descField = fields.find((f) => f.field_type === "textarea" || f.slug === "descricao");
  const fileField = fields.find((f) => f.field_type === "file");
  const imageField = fields.find((f) => f.field_type === "image");
  const dateField = fields.find((f) => f.field_type === "date");

  const downloadField = fileField || imageField;

  return (
    <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
      {items.map((item, i) => {
        const title = titleField ? String(item.data[titleField.slug] || "") : "";
        const desc = descField ? String(item.data[descField.slug] || "") : "";
        const fileUrl = downloadField ? String(item.data[downloadField.slug] || "") : "";
        const date = dateField ? String(item.data[dateField.slug] || "") : "";
        const FileIcon = getFileIcon(fileUrl);

        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors group",
              i < items.length - 1 && "border-b border-ink-50"
            )}
          >
            {/* File icon / thumbnail */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">
              {fileUrl && imageField && downloadField === imageField ? (
                <img src={fileUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <FileIcon size={18} className="text-ink-400" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">{title || getFileName(fileUrl)}</p>
              {desc && <p className="text-xs text-ink-500 truncate mt-0.5">{desc}</p>}
            </div>

            {/* Date */}
            {date && (
              <span className="text-xs text-ink-400 shrink-0">
                {new Date(date).toLocaleDateString("pt-BR")}
              </span>
            )}

            {/* Status */}
            {item.status !== "published" && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning shrink-0">
                Rascunho
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0 transition-opacity">
              {fileUrl && (
                <a
                  href={fileUrl}
                  download
                  className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors"
                  title="Baixar arquivo"
                >
                  <Download size={14} />
                </a>
              )}
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                  title="Visualizar"
                >
                  <Eye size={14} />
                </a>
              )}
              <button
                onClick={() => onEdit(item)}
                className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              {onDuplicate && (
                <button
                  onClick={() => onDuplicate(item.id)}
                  disabled={isPending}
                  className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                  title="Duplicar"
                >
                  <Copy size={14} />
                </button>
              )}
              <button
                onClick={() => onDelete(item.id)}
                disabled={isPending}
                className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors"
                title="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
