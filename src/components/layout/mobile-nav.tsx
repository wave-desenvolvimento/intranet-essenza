"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Layers, Stamp, User, X, Menu,
  Building2, ShoppingCart, Package, BarChart3, MonitorCog, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
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
}

interface Props {
  cmsPages?: CmsPage[];
}

// System nav items — same as sidebar
interface NavItem { name: string; href: string; icon: LucideIcon; module: string; action?: string }

interface NavSection { label: string; items: NavItem[] }

const DRAWER_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { name: "Início", href: "/inicio", icon: LayoutDashboard, module: "dashboard" },
      { name: "Templates", href: "/templates", icon: Stamp, module: "templates" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { name: "Novo Pedido", href: "/novo-pedido", icon: ShoppingCart, module: "pedidos" },
      { name: "Gestão Pedidos", href: "/gestao-de-pedidos", icon: Package, module: "pedidos", action: "view_all" },
      { name: "Produtos", href: "/produtos", icon: Package, module: "pedidos", action: "manage" },
    ],
  },
  {
    label: "Administração",
    items: [
      { name: "Franquias", href: "/franquias", icon: Building2, module: "franquias" },
      { name: "Relatórios", href: "/relatorios", icon: BarChart3, module: "analytics" },
      { name: "CMS", href: "/cms", icon: MonitorCog, module: "cms" },
      { name: "Permissões", href: "/configuracoes", icon: ShieldCheck, module: "configuracoes" },
    ],
  },
];

export function MobileNav({ cmsPages = [] }: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { can, canModule, loading: permissionsLoading } = usePermissions();

  const groups = cmsPages.filter((p) => p.is_group);

  function filterItems(items: NavItem[]) {
    if (permissionsLoading) return [];
    return items.filter((item) => {
      if (!canModule(item.module)) return false;
      if (item.action && !can(`${item.module}.${item.action}`)) return false;
      return true;
    });
  }

  function isActive(href: string) {
    if (href === "#drawer") return drawerOpen;
    // Exact match when siblings exist
    const allItems = DRAWER_SECTIONS.flatMap((s) => s.items);
    const hasSibling = allItems.some((n) => n.href !== href && n.href.startsWith(href + "/"));
    return hasSibling ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
  }


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
              {/* System navigation — sections */}
              {DRAWER_SECTIONS.map((section) => {
                const items = filterItems(section.items);
                if (items.length === 0) return null;
                return (
                  <div key={section.label || "home"} className="mb-3">
                    {section.label && (
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{section.label}</p>
                    )}
                    {items.map((item) => {
                      const active = isActive(item.href);
                      const tourId = `drawer-${item.href.replace(/\//g, "-").replace(/^-/, "")}`;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          data-tour={tourId}
                          onClick={() => setDrawerOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                            active ? "bg-brand-olive-soft text-brand-olive font-medium" : "text-ink-700 hover:bg-ink-50"
                          )}
                        >
                          <item.icon size={17} className={active ? "text-brand-olive" : "text-ink-400"} />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}

              {/* CMS page groups — content */}
              {groups.map((group) => {
                const children = cmsPages.filter((p) => p.parent_id === group.id && !p.is_group && (permissionsLoading || canModule(p.slug)));
                if (children.length === 0) return null;
                return (
                  <div key={group.slug} className="mb-4">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                      {group.title}
                    </p>
                    {children.map((page) => {
                      const Icon = (getIconComponent(page.icon) as LucideIcon) || Layers;
                      const active = pathname === `/pagina/${page.slug}`;
                      return (
                        <Link
                          key={page.slug}
                          href={`/pagina/${page.slug}`}
                          data-tour={`drawer-p-${page.slug}`}
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
