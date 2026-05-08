"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Command, FileText, Image, Megaphone, Layers, Folder, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getIconComponent } from "@/components/ui/icon-picker";
import { useRouter } from "next/navigation";

function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.platform?.toUpperCase().includes("MAC") || navigator.userAgent?.includes("Mac"));
  }, []);
  return isMac;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface SearchResult {
  id: string;
  type: "page" | "item";
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMac = useIsMac();
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);

    const supabase = createClient();
    const searchResults: SearchResult[] = [];

    // Search pages
    const { data: pages } = await supabase
      .from("cms_pages")
      .select("id, title, slug, icon, is_group")
      .ilike("title", `%${q}%`)
      .limit(5);

    for (const p of pages || []) {
      searchResults.push({
        id: `page-${p.id}`,
        type: "page",
        title: p.title,
        subtitle: p.is_group ? "Seção" : `/pagina/${p.slug}`,
        icon: p.icon,
        href: p.is_group ? "/cms" : `/pagina/${p.slug}`,
      });
    }

    // Search items (search in data jsonb via text cast — all statuses)
    const { data: items } = await supabase
      .from("cms_items")
      .select("id, data, collection_id, status")
      .ilike("data::text", `%${q}%`)
      .limit(15);

    if (items && items.length > 0) {
      // Get collection info for these items
      const collectionIds = [...new Set(items.map((i) => i.collection_id))];
      const { data: collections } = await supabase
        .from("cms_collections")
        .select("id, name, slug")
        .in("id", collectionIds);

      // Get page slugs for collections
      const { data: pageLinks } = await supabase
        .from("cms_page_collections")
        .select("collection_id, page:cms_pages(slug)")
        .in("collection_id", collectionIds)
        .eq("role", "main");

      const colMap = new Map((collections || []).map((c) => [c.id, c]));
      const pageMap = new Map((pageLinks || []).map((pl) => {
        const page = Array.isArray(pl.page) ? pl.page[0] : pl.page;
        return [pl.collection_id, page?.slug || ""];
      }));

      for (const item of items) {
        const d = item.data as Record<string, unknown>;
        // Try common title fields, fallback to first string value
        let title = String(d.titulo || d.title || d.nome || "").trim();
        if (!title) {
          const firstStr = Object.values(d).find((v) => typeof v === "string" && v.length > 2 && !String(v).startsWith("http"));
          title = firstStr ? String(firstStr).replace(/<[^>]*>/g, "").trim().slice(0, 60) : "";
        }
        if (!title) continue;

        const col = colMap.get(item.collection_id);
        const pageSlug = pageMap.get(item.collection_id);
        const statusLabel = item.status === "draft" ? " · Rascunho" : "";

        searchResults.push({
          id: `item-${item.id}`,
          type: "item",
          title,
          subtitle: (col?.name || "") + statusLabel,
          icon: "file",
          href: pageSlug ? `/pagina/${pageSlug}` : `/cms/${col?.slug || ""}`,
        });
      }
    }

    setResults(searchResults);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const ICON_MAP: Record<string, React.ElementType> = {
    folder: Folder, image: Image, megaphone: Megaphone, file: FileText, layers: Layers,
  };

  function resolveIcon(icon: string): React.ElementType {
    return getIconComponent(icon) || ICON_MAP[icon] || FileText;
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-[9px] h-9 text-sm text-ink-400 hover:bg-ink-100 transition-colors",
          isMobile ? "w-9 justify-center bg-transparent" : "bg-ink-50 px-3 w-64"
        )}
        title="Buscar (⌘K)"
      >
        <Search size={isMobile ? 18 : 14} />
        {!isMobile && <span className="flex-1 text-left">Buscar...</span>}
        {!isMobile && (
          <kbd className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-400 border border-ink-100">
            {isMac ? <Command size={10} /> : "Ctrl"}
            <span className="leading-0">K</span>
          </kbd>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[8vh] sm:pt-[15vh] px-3 sm:px-0"
          onClick={() => { setOpen(false); setQuery(""); }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-modal overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-ink-100 px-4 h-12">
              <Search size={16} className="text-ink-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar páginas, campanhas, materiais..."
                className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-ink-400 hover:text-ink-700 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {!query && (
                <p className="px-4 py-6 text-center text-sm text-ink-400">
                  Digite para buscar páginas, campanhas, materiais...
                </p>
              )}

              {query && loading && (
                <p className="px-4 py-6 text-center text-sm text-ink-400">Buscando...</p>
              )}

              {query && !loading && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-400">
                  Nenhum resultado para &ldquo;{query}&rdquo;
                </p>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {/* Pages */}
                  {results.filter((r) => r.type === "page").length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Páginas</p>
                      {results.filter((r) => r.type === "page").map((r) => {
                        const Icon = resolveIcon(r.icon);
                        return (
                          <button
                            key={r.id}
                            onClick={() => navigate(r.href)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-ink-50 transition-colors"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
                              <Icon size={14} className="text-brand-olive" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink-900 truncate">{r.title}</p>
                              <p className="text-[10px] text-ink-400">{r.subtitle}</p>
                            </div>
                            <ArrowRight size={12} className="text-ink-300 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Items */}
                  {results.filter((r) => r.type === "item").length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Conteúdos</p>
                      {results.filter((r) => r.type === "item").map((r) => (
                        <button
                          key={r.id}
                          onClick={() => navigate(r.href)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-ink-50 transition-colors"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                            <FileText size={14} className="text-ink-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{r.title}</p>
                            <p className="text-[10px] text-ink-400">{r.subtitle}</p>
                          </div>
                          <ArrowRight size={12} className="text-ink-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
