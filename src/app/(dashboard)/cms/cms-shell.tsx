"use client";

import { useState, useTransition } from "react";
import { Database, FileText, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { CmsOverview } from "./cms-overview";
import { PagesManager } from "./pages-manager";
import { setAppSetting } from "./settings-actions";
import { toast } from "sonner";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  parent_id: string | null;
  is_group: boolean;
  view_type: string;
  fields: { id: string }[];
  items: { id: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Page { [key: string]: any; }

interface Props {
  collections: Collection[];
  pages: Page[];
  folderCardStyle?: string;
}

export function CmsShell({ collections, pages, folderCardStyle: initialStyle }: Props) {
  const [tab, setTab] = useState<"collections" | "pages" | "styles">("collections");
  const [folderStyle, setFolderStyle] = useState(initialStyle || "default");
  const [isPending, startTransition] = useTransition();

  function toggleFolderStyle() {
    const next = folderStyle === "default" ? "folder" : "default";
    setFolderStyle(next);
    startTransition(async () => {
      const res = await setAppSetting("folder_card_style", next);
      if (res.error) toast.error(res.error);
      else toast.success(`Estilo de pasta: ${next === "folder" ? "Formato pasta" : "Padrão"}`);
    });
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1 w-fit mb-5">
        <button onClick={() => setTab("collections")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === "collections" ? "bg-white text-ink-900 shadow-card" : "text-ink-500")}>
          <span className="flex items-center gap-1.5"><Database size={14} /> Coleções</span>
        </button>
        <button onClick={() => setTab("pages")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === "pages" ? "bg-white text-ink-900 shadow-card" : "text-ink-500")}>
          <span className="flex items-center gap-1.5"><FileText size={14} /> Páginas</span>
        </button>
        <button onClick={() => setTab("styles")} className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === "styles" ? "bg-white text-ink-900 shadow-card" : "text-ink-500")}>
          <span className="flex items-center gap-1.5"><Palette size={14} /> Estilos</span>
        </button>
      </div>

      {tab === "collections" && <CmsOverview collections={collections} />}
      {tab === "pages" && <PagesManager pages={pages} collections={collections} />}
      {tab === "styles" && (
        <div className="max-w-lg">
          <h2 className="text-base font-semibold text-ink-900 mb-4">Estilos visuais</h2>
          <div className="rounded-xl border border-ink-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink-900">Estilo de pastas</p>
                <p className="text-xs text-ink-500 mt-0.5">Cards em formato de pasta com aba superior</p>
              </div>
              <button
                onClick={toggleFolderStyle}
                disabled={isPending}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50",
                  folderStyle === "folder" ? "bg-brand-olive" : "bg-ink-200"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                  folderStyle === "folder" ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            </div>
            {/* Preview */}
            <div className="mt-4 flex gap-3">
              <FolderPreview style="default" active={folderStyle === "default"} />
              <FolderPreview style="folder" active={folderStyle === "folder"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderPreview({ style, active }: { style: "default" | "folder"; active: boolean }) {
  return (
    <div className={cn("flex-1 rounded-lg border-2 p-3 transition-colors", active ? "border-brand-olive bg-brand-olive-soft/10" : "border-ink-100")}>
      <p className="text-[10px] font-medium text-ink-500 mb-2">{style === "default" ? "Padrão" : "Formato pasta"}</p>
      {style === "default" ? (
        <div className="rounded-lg border border-ink-100 bg-white overflow-hidden">
          <div className="aspect-[4/3] bg-[#5C5441]" />
          <div className="px-2 py-1.5">
            <div className="h-2 w-12 rounded bg-ink-100" />
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-0 left-2 w-10 h-3 rounded-t-md bg-[#5C5441]" />
          <div className="mt-2 rounded-lg border border-ink-100 bg-white overflow-hidden">
            <div className="aspect-[4/3] bg-[#5C5441] rounded-tr-lg" />
            <div className="px-2 py-1.5">
              <div className="h-2 w-12 rounded bg-ink-100" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
