"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, ShoppingCart, User, X, Menu, Folder } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { getIconComponent } from "@/components/ui/icon-picker";
import { usePermissions } from "@/hooks/use-permissions";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  is_group: boolean;
  page_type?: string;
  href?: string | null;
  module?: string | null;
  required_action?: string | null;
}

interface Props {
  cmsPages?: CmsPage[];
}

function resolveHref(page: CmsPage): string {
  if (page.page_type === "system" && page.href) return page.href;
  return `/pagina/${page.slug}`;
}

export function MobileNav({ cmsPages = [] }: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { can, canModule, loading: permissionsLoading } = usePermissions();

  function canViewPage(page: CmsPage): boolean {
    if (page.page_type === "system") {
      if (!page.module) return true;
      if (!canModule(page.module)) return false;
      if (page.required_action && !can(`${page.module}.${page.required_action}`)) return false;
      return true;
    }
    return canModule(page.slug);
  }

  function isActive(href: string) {
    if (href === "#drawer") return drawerOpen;
    const allHrefs = cmsPages.filter((p) => !p.is_group).map(resolveHref);
    const hasSibling = allHrefs.some((h) => h !== href && h.startsWith(href + "/"));
    return hasSibling ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
  }

  const groups = cmsPages.filter((p) => p.is_group);
  const rootPages = cmsPages.filter((p) => !p.parent_id && !p.is_group);

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ink-100" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-14">
          <Link href="/inicio" onClick={() => setDrawerOpen(false)} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors", pathname === "/inicio" ? "text-brand-olive" : "text-ink-400")}>
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-medium">Início</span>
          </Link>
          <button data-tour="mobile-menu-btn" onClick={() => setDrawerOpen(!drawerOpen)} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors", drawerOpen ? "text-brand-olive" : "text-ink-400")}>
            <Menu size={20} />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
          <Link data-tour="mobile-pedidos-btn" href="/novo-pedido" onClick={() => setDrawerOpen(false)} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors", pathname.startsWith("/novo-pedido") ? "text-brand-olive" : "text-ink-400")}>
            <ShoppingCart size={20} />
            <span className="text-[10px] font-medium">Pedidos</span>
          </Link>
          <Link href="/perfil" onClick={() => setDrawerOpen(false)} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors", pathname === "/perfil" ? "text-brand-olive" : "text-ink-400")}>
            <User size={20} />
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        </div>
      </nav>

      {/* Drawer — full navigation */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div data-tour="mobile-drawer" className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-modal flex flex-col animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
              <BrandLogo width={100} height={48} />
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-50">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {/* Root pages */}
              {!permissionsLoading && rootPages.filter(canViewPage).map((page) => {
                const href = resolveHref(page);
                const active = isActive(href);
                const Icon = getIconComponent(page.icon) || Folder;
                return (
                  <Link
                    key={page.id}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active ? "bg-brand-olive-soft text-brand-olive font-medium" : "text-ink-700 hover:bg-ink-50"
                    )}
                  >
                    <Icon size={17} className={active ? "text-brand-olive" : "text-ink-400"} />
                    {page.title}
                  </Link>
                );
              })}

              {/* Grouped sections */}
              {!permissionsLoading && groups.map((group) => {
                const children = cmsPages
                  .filter((p) => p.parent_id === group.id && !p.is_group)
                  .filter(canViewPage);
                if (children.length === 0) return null;
                return (
                  <div key={group.id} className="mb-3">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                      {group.title}
                    </p>
                    {children.map((page) => {
                      const href = resolveHref(page);
                      const active = isActive(href);
                      const Icon = getIconComponent(page.icon) || Folder;
                      return (
                        <Link
                          key={page.id}
                          href={href}
                          data-tour={`drawer-${page.slug}`}
                          onClick={() => setDrawerOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                            active ? "bg-brand-olive-soft text-brand-olive font-medium" : "text-ink-700 hover:bg-ink-50"
                          )}
                        >
                          <Icon size={17} className={active ? "text-brand-olive" : "text-ink-400"} />
                          {page.title}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <a
              href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-auto pb-2 text-center text-[10px] text-ink-300 hover:text-ink-500 transition-colors"
            >
              construído por WaveCommerce
            </a>
          </div>
        </div>
      )}
    </>
  );
}
