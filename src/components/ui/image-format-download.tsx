"use client";

import { useState } from "react";
import { Download, X, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFile, downloadFilesAsZip } from "@/lib/download";

export interface ImageVariant {
  label: string;
  url: string;
}

interface Props {
  /** URL da imagem principal (sempre mostrada como "Original") */
  imageUrl: string;
  /** Variantes extras enviadas pelo usuário (formato → URL) */
  variants?: ImageVariant[];
  className?: string;
}

export function ImageFormatDownload({ imageUrl, variants = [], className }: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const hasVariants = variants.length > 0;
  const baseName = imageUrl.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") || "imagem";

  async function handleDownloadSingle(url: string, label: string) {
    const ext = url.split(".").pop()?.split("?")[0] || "jpg";
    await downloadFile(url, `${baseName}_${label}.${ext}`);
  }

  async function handleDownloadAll() {
    setDownloading(true);
    const origExt = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const files = [
      { url: imageUrl, filename: `${baseName}_original.${origExt}` },
      ...variants.map((v) => {
        const ext = v.url.split(".").pop()?.split("?")[0] || "jpg";
        return { url: v.url, filename: `${baseName}_${v.label}.${ext}` };
      }),
    ];
    await downloadFilesAsZip(files, `${baseName}_todos-formatos.zip`);
    setDownloading(false);
  }

  if (!imageUrl) return null;

  // Se não tem variantes, botão simples de download
  if (!hasVariants) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); downloadFile(imageUrl); }}
        className={cn("flex items-center gap-1.5 rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors", className)}
        title="Baixar"
      >
        <Download size={14} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn("flex items-center gap-1.5 rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors", className)}
        title="Baixar em formatos"
      >
        <Download size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
              <h3 className="text-sm font-semibold text-ink-900">Baixar imagem</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3">
              <div className="h-32 rounded-lg bg-ink-50 overflow-hidden">
                <img src={imageUrl} alt="" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Baixar todos */}
            <div className="px-5 pb-3">
              <button
                onClick={handleDownloadAll}
                disabled={downloading}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
              >
                <Package size={14} />
                {downloading ? "Baixando..." : "Baixar todos os formatos"}
              </button>
            </div>

            {/* Individual */}
            <div className="px-5 pb-5 flex flex-col">
              <button
                onClick={() => handleDownloadSingle(imageUrl, "original")}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-ink-50 transition-colors"
              >
                <Download size={14} className="text-brand-olive shrink-0" />
                <span className="flex-1 text-left font-medium">Original</span>
              </button>
              {variants.map((v) => (
                <button
                  key={v.label}
                  onClick={() => handleDownloadSingle(v.url, v.label)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <Download size={14} className="text-ink-400 shrink-0" />
                  <span className="flex-1 text-left">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
