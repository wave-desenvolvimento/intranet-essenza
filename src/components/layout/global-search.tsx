"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, X, Command, FileText, Image, Megaphone, Layers, Folder, ArrowRight,
  Building2, Package, ShoppingCart, Users, MessageSquare, HelpCircle, BarChart3,
  Film,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, isAssetVisible } from "@/lib/utils";
import { getIconComponent } from "@/components/ui/icon-picker";
import { useRouter } from "next/navigation";
import { useIsMac } from "@/hooks/use-platform";

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
  type: "page" | "item" | "franchise" | "product" | "order" | "user" | "announcement" | "faq" | "survey" | "asset";
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  thumbnail?: string;
}

const TYPE_CONFIG: Record<SearchResult["type"], { label: string; icon: React.ElementType; bg: string; color: string }> = {
  page: { label: "Páginas", icon: Layers, bg: "bg-brand-olive-soft", color: "text-brand-olive" },
  item: { label: "Conteúdos", icon: FileText, bg: "bg-ink-50", color: "text-ink-400" },
  franchise: { label: "Franquias", icon: Building2, bg: "bg-info-soft", color: "text-info" },
  product: { label: "Produtos", icon: Package, bg: "bg-success-soft", color: "text-success" },
  order: { label: "Pedidos", icon: ShoppingCart, bg: "bg-warning-soft", color: "text-warning" },
  user: { label: "Usuários", icon: Users, bg: "bg-brand-olive-soft", color: "text-brand-olive" },
  announcement: { label: "Comunicados", icon: MessageSquare, bg: "bg-info-soft", color: "text-info" },
  faq: { label: "FAQ", icon: HelpCircle, bg: "bg-success-soft", color: "text-success" },
  survey: { label: "Pesquisas", icon: BarChart3, bg: "bg-warning-soft", color: "text-warning" },
  asset: { label: "Arquivos e Mídias", icon: Image, bg: "bg-purple-50", color: "text-purple-600" },
};

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
    const all: SearchResult[] = [];

    // Run all searches in parallel
    const [pages, items, franchises, products, orders, profiles, announcements, faqItems, surveys, mediaFields, matchingFolders, matchingCollections] = await Promise.all([
      // Pages
      supabase.from("cms_pages").select("id, title, slug, icon, is_group").ilike("title", `%${q}%`).limit(5),
      // CMS Items (data + tags via RPC - PostgREST não suporta ::text cast em ilike)
      supabase.rpc("search_cms_items", { search_term: q, result_limit: 20 }),
      // Franchises
      supabase.from("franchises").select("id, name, slug, city, segment").or(`name.ilike.%${q}%,city.ilike.%${q}%,cnpj.ilike.%${q}%`).limit(5),
      // Products
      supabase.from("products").select("id, name, sku, category").or(`name.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`).eq("active", true).limit(5),
      // Orders
      supabase.from("orders").select("id, status, total, created_at, purchase_order, franchises(name)").or(`id.ilike.%${q}%,purchase_order.ilike.%${q}%`).order("created_at", { ascending: false }).limit(5),
      // Users/Profiles
      supabase.from("profiles").select("id, full_name, franchise_id, franchises(name)").ilike("full_name", `%${q}%`).limit(5),
      // Announcements
      supabase.from("announcements").select("id, title, priority, created_at").ilike("title", `%${q}%`).order("created_at", { ascending: false }).limit(5),
      // FAQ
      supabase.from("faq_items").select("id, question, faq_categories(name)").ilike("question", `%${q}%`).limit(5),
      // Surveys
      supabase.from("surveys").select("id, title, active").ilike("title", `%${q}%`).limit(5),
      // Media fields for asset extraction
      supabase.from("cms_fields").select("collection_id, slug, name, field_type").in("field_type", ["image", "image_array", "image_variants", "file", "file_array"]),
      // Folders matching search term (to find items inside)
      supabase.from("cms_folders").select("id, name").ilike("name", `%${q}%`).limit(10),
      // Collections matching search term
      supabase.from("cms_collections").select("id, name, slug").ilike("name", `%${q}%`).limit(10),
    ]);

    // Pages
    for (const p of pages.data || []) {
      all.push({
        id: `page-${p.id}`, type: "page", title: p.title,
        subtitle: p.is_group ? "Seção" : "Página",
        icon: p.icon, href: p.is_group ? "/cms" : `/pagina/${p.slug}`,
      });
    }

    // CMS Items - merge RPC results + folder/collection name-matched items
    const allCmsItems: { id: string; data: unknown; collection_id: string; status: string; folder_id?: string | null }[] = [...(items.data || [])];
    const seenItemIds = new Set(allCmsItems.map((i) => i.id));

    // Add items from folders whose name matches the query
    if (matchingFolders.data && matchingFolders.data.length > 0) {
      const folderIds = matchingFolders.data.map((f: { id: string }) => f.id);
      const { data: folderItems } = await supabase
        .from("cms_items")
        .select("id, data, collection_id, status, folder_id")
        .in("folder_id", folderIds)
        .eq("status", "published")
        .limit(15);
      for (const fi of folderItems || []) {
        if (!seenItemIds.has(fi.id)) { allCmsItems.push(fi); seenItemIds.add(fi.id); }
      }
    }

    // Add items from collections whose name matches the query
    if (matchingCollections.data && matchingCollections.data.length > 0) {
      const colIds = matchingCollections.data.map((c: { id: string }) => c.id);
      const { data: colItems } = await supabase
        .from("cms_items")
        .select("id, data, collection_id, status, folder_id")
        .in("collection_id", colIds)
        .eq("status", "published")
        .limit(15);
      for (const ci of colItems || []) {
        if (!seenItemIds.has(ci.id)) { allCmsItems.push(ci); seenItemIds.add(ci.id); }
      }
    }

    // Dedicated search for items in media-containing collections via RPC
    if (mediaFields.data && mediaFields.data.length > 0) {
      const mediaColIds = [...new Set(mediaFields.data.map((mf: { collection_id: string }) => mf.collection_id))];
      const { data: mediaItems } = await supabase.rpc("search_cms_items", {
        search_term: q, filter_collection_ids: mediaColIds, filter_status: "published", result_limit: 15,
      });
      for (const mi of mediaItems || []) {
        if (!seenItemIds.has(mi.id)) { allCmsItems.push(mi); seenItemIds.add(mi.id); }
      }
    }

    if (allCmsItems.length > 0) {
      const collectionIds = [...new Set(allCmsItems.map((i) => i.collection_id))];
      const [cols, pageLinks] = await Promise.all([
        supabase.from("cms_collections").select("id, name, slug").in("id", collectionIds),
        supabase.from("cms_page_collections").select("collection_id, page:cms_pages(slug)").in("collection_id", collectionIds).eq("role", "main"),
      ]);
      const colMap = new Map((cols.data || []).map((c) => [c.id, c]));
      const pageMap = new Map((pageLinks.data || []).map((pl) => {
        const page = Array.isArray(pl.page) ? pl.page[0] : pl.page;
        return [pl.collection_id, page?.slug || ""];
      }));

      // Build media fields map (used for item thumbnails + asset extraction)
      const mediaByCol = new Map<string, NonNullable<typeof mediaFields.data>>();
      if (mediaFields.data) {
        for (const mf of mediaFields.data) {
          const arr = mediaByCol.get(mf.collection_id) || [];
          arr.push(mf);
          mediaByCol.set(mf.collection_id, arr);
        }
      }

      for (const item of allCmsItems) {
        const d = item.data as Record<string, unknown>;
        let title = String(d.titulo || d.title || d.nome || "").trim();
        if (!title) {
          const firstStr = Object.values(d).find((v) => typeof v === "string" && v.length > 2 && !String(v).startsWith("http"));
          title = firstStr ? String(firstStr).replace(/<[^>]*>/g, "").trim().slice(0, 60) : "";
        }
        if (!title) continue;
        const col = colMap.get(item.collection_id);
        const pageSlug = pageMap.get(item.collection_id);
        const itemParams = new URLSearchParams();
        if (item.folder_id) itemParams.set("folder", item.folder_id);
        itemParams.set("item", item.id);
        const itemQs = itemParams.toString();

        // Extract first image as thumbnail
        let thumb: string | undefined;
        const imgFields = mediaByCol.get(item.collection_id);
        if (imgFields) {
          for (const f of imgFields) {
            if (thumb) break;
            const raw = d[f.slug];
            if (!raw) continue;
            if ((f.field_type === "image") && typeof raw === "string") {
              thumb = raw;
            } else if (f.field_type === "image_variants" && typeof raw === "object" && !Array.isArray(raw)) {
              thumb = Object.values(raw as Record<string, string>).find((u) => u) || undefined;
            } else if (f.field_type === "image_array" && Array.isArray(raw)) {
              const visibleImgs = (raw as { url: string; published_at?: string | null; expires_at?: string | null }[]).filter((a) => isAssetVisible(a));
              thumb = visibleImgs[0]?.url || undefined;
            }
          }
        }

        all.push({
          id: `item-${item.id}`, type: "item", title,
          subtitle: (col?.name || "") + (item.status === "draft" ? " · Rascunho" : ""),
          icon: "file", href: pageSlug ? `/pagina/${pageSlug}?${itemQs}` : `/cms/${col?.slug || ""}`,
          thumbnail: thumb,
        });
      }

      // Extract assets (images, files, videos) from matching CMS items
      if (mediaFields.data && mediaFields.data.length > 0) {

        let assetCount = 0;
        for (const item of allCmsItems) {
          if (assetCount >= 8) break;
          const mf = mediaByCol.get(item.collection_id);
          if (!mf) continue;

          const d = item.data as Record<string, unknown>;
          let itemTitle = String(d.titulo || d.title || d.nome || "").trim();
          if (!itemTitle) {
            const firstStr = Object.values(d).find((v) => typeof v === "string" && v.length > 2 && !String(v).startsWith("http"));
            itemTitle = firstStr ? String(firstStr).replace(/<[^>]*>/g, "").trim().slice(0, 60) : "";
          }

          const col = colMap.get(item.collection_id);
          const ps = pageMap.get(item.collection_id);
          if (!itemTitle) itemTitle = col?.name || "Sem título";

          for (const field of mf) {
            if (assetCount >= 8) break;
            const raw = d[field.slug];
            if (!raw) continue;

            const assetParams = new URLSearchParams();
            if (item.folder_id) assetParams.set("folder", item.folder_id as string);
            assetParams.set("item", item.id);
            const assetQs = assetParams.toString();

            const addAsset = (url: string, label: string) => {
              if (assetCount >= 8) return;
              const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
              const isImg = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext);
              const isVid = ["mp4", "webm", "mov", "avi"].includes(ext);
              all.push({
                id: `asset-${item.id}-${field.slug}-${assetCount}`,
                type: "asset",
                title: `${itemTitle} - ${label}`,
                subtitle: `${isImg ? "Imagem" : isVid ? "Vídeo" : ext.toUpperCase()} · ${col?.name || ""}`,
                icon: isImg ? "image" : isVid ? "video" : "file",
                href: ps ? `/pagina/${ps}?${assetQs}` : "/biblioteca",
                thumbnail: isImg ? url : undefined,
              });
              assetCount++;
            };

            if ((field.field_type === "image" || field.field_type === "file") && typeof raw === "string") {
              addAsset(raw, field.name);
            } else if (field.field_type === "image_variants" && typeof raw === "object" && !Array.isArray(raw)) {
              for (const [variant, url] of Object.entries(raw as Record<string, string>)) {
                if (url) addAsset(url, variant);
              }
            } else if (Array.isArray(raw)) {
              for (const entry of raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]) {
                if (entry.url && isAssetVisible(entry)) addAsset(entry.url, entry.title || field.name);
              }
            }
          }
        }
      }
    }

    // Franchises
    for (const f of franchises.data || []) {
      all.push({
        id: `franchise-${f.id}`, type: "franchise", title: f.name,
        subtitle: [f.city, f.segment === "multimarca_pdv" ? "Multimarca" : "Franquia"].filter(Boolean).join(" · "),
        icon: "building", href: `/franquias/${f.slug}`,
      });
    }

    // Products
    for (const p of products.data || []) {
      all.push({
        id: `product-${p.id}`, type: "product", title: p.name,
        subtitle: [p.sku, p.category].filter(Boolean).join(" · "),
        icon: "package", href: "/produtos",
      });
    }

    // Orders
    for (const o of orders.data || []) {
      const fname = (Array.isArray(o.franchises) ? o.franchises[0] : o.franchises) as { name: string } | null;
      const oc = o.purchase_order || `#${o.id.slice(0, 8)}`;
      all.push({
        id: `order-${o.id}`, type: "order", title: oc,
        subtitle: [fname?.name, o.status, `R$ ${Number(o.total).toFixed(2)}`].filter(Boolean).join(" · "),
        icon: "cart", href: "/gestao-de-pedidos",
      });
    }

    // Users
    for (const u of profiles.data || []) {
      const fname = (Array.isArray(u.franchises) ? u.franchises[0] : u.franchises) as { name: string } | null;
      all.push({
        id: `user-${u.id}`, type: "user", title: u.full_name,
        subtitle: fname?.name || "Sem franquia",
        icon: "users", href: u.franchise_id ? `/franquias/${u.franchise_id}` : "/usuarios",
      });
    }

    // Announcements
    for (const a of announcements.data || []) {
      all.push({
        id: `ann-${a.id}`, type: "announcement", title: a.title,
        subtitle: a.priority === "urgent" ? "Urgente" : a.priority === "pinned" ? "Fixado" : "Comunicado",
        icon: "message", href: "/comunicados",
      });
    }

    // FAQ
    for (const f of faqItems.data || []) {
      const cat = (Array.isArray(f.faq_categories) ? f.faq_categories[0] : f.faq_categories) as { name: string } | null;
      all.push({
        id: `faq-${f.id}`, type: "faq", title: f.question,
        subtitle: cat?.name || "FAQ",
        icon: "help", href: "/faq",
      });
    }

    // Surveys
    for (const s of surveys.data || []) {
      all.push({
        id: `survey-${s.id}`, type: "survey", title: s.title,
        subtitle: s.active ? "Ativa" : "Inativa",
        icon: "chart", href: "/pesquisas",
      });
    }

    setResults(all);
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
    folder: Folder, image: Image, megaphone: Megaphone, file: FileText, layers: Layers, video: Film,
  };

  function resolveIcon(icon: string): React.ElementType {
    return getIconComponent(icon) || ICON_MAP[icon] || FileText;
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const typeOrder: SearchResult["type"][] = ["page", "item", "asset", "franchise", "product", "order", "user", "announcement", "faq", "survey"];

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-[9px] h-9 text-sm text-ink-400 hover:bg-ink-100 transition-colors",
          isMobile ? "w-9 justify-center bg-transparent" : "bg-ink-50 px-3 w-64"
        )}
        title={`Buscar (${isMac ? "⌘" : "Ctrl+"}K)`}
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
                placeholder="Buscar páginas, arquivos, produtos, pedidos..."
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
                  Digite para buscar em todos os módulos
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
                  {typeOrder.map((type) => {
                    const items = grouped[type];
                    if (!items || items.length === 0) return null;
                    const config = TYPE_CONFIG[type];
                    return (
                      <div key={type}>
                        <p className="px-4 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{config.label}</p>
                        {items.map((r) => {
                          const Icon = (r.type === "page" || r.type === "asset") ? resolveIcon(r.icon) : config.icon;
                          return (
                            <button
                              key={r.id}
                              onClick={() => navigate(r.href)}
                              className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-ink-50 transition-colors"
                            >
                              {r.thumbnail ? (
                                <img src={r.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                              ) : (
                                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.bg)}>
                                  <Icon size={14} className={config.color} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-ink-900 truncate">{r.title}</p>
                                <p className="text-[10px] text-ink-400 truncate">{r.subtitle}</p>
                              </div>
                              <ArrowRight size={12} className="text-ink-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
