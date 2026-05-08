"use client";

import { useState } from "react";
import { Share2, Copy, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createShareLink } from "@/app/(dashboard)/cms/share-action";

interface Props {
  imageUrl: string;
  className?: string;
}

export function ShareLink({ imageUrl, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setLink("");
    const result = await createShareLink(imageUrl, 86400);
    setLoading(false);
    if (result.url) setLink(result.url);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!imageUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); setLink(""); setCopied(false); generate(); }}
        className={cn("rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors", className)}
        title="Compartilhar link"
      >
        <Share2 size={12} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
              <h3 className="text-sm font-semibold text-ink-900">Compartilhar imagem</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-ink-500">
                  <Loader2 size={14} className="animate-spin" /> Gerando link...
                </div>
              ) : link ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2">
                    <input
                      value={link}
                      readOnly
                      className="flex-1 bg-transparent text-xs text-ink-700 font-mono outline-none truncate"
                    />
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-olive hover:bg-brand-olive-soft transition-colors"
                    >
                      {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-400">
                    Este link expira em 24 horas. Qualquer pessoa com o link pode visualizar.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-400 py-4 text-center">Erro ao gerar link</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
