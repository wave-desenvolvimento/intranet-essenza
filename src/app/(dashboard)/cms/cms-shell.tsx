"use client";

import { useState } from "react";
import { Database, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { CmsOverview } from "./cms-overview";
import { PagesManager } from "./pages-manager";

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
}

export function CmsShell({ collections, pages }: Props) {
  const [tab, setTab] = useState<"collections" | "pages">("collections");

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
      </div>

      {tab === "collections" && <CmsOverview collections={collections} />}
      {tab === "pages" && <PagesManager pages={pages} collections={collections} />}
    </div>
  );
}
