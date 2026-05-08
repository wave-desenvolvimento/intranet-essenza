"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  MonitorCog,
  Building2,
  ShieldCheck,
  ChevronRight,
  Palette,
  FileText,
  Megaphone,
  Share2,
  Image,
  Video,
  GraduationCap,
  BookOpen,
  Layers,
  Database,
  Folder,
  BarChart3,
  Stamp,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Package,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { getIconComponent } from "@/components/ui/icon-picker";
import { useState, useEffect } from "react";


interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  module: string;
  action?: string; // if set, requires this specific permission (module.action)
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { name: "Início", href: "/inicio", icon: LayoutDashboard, module: "dashboard" },
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

const COLLECTION_ICON_MAP: Record<string, LucideIcon> = {
  layers: Layers, image: Image, megaphone: Megaphone, file: FileText,
  database: Database, folder: Folder,
};

const SLUG_ICON_MAP: Record<string, LucideIcon> = {
  "universo-da-marca": Palette,
  "material-corporativo": FileText,
  campanhas: Megaphone,
  "redes-sociais": Share2,
  biblioteca: Image,
  videos: Video,
  treinamento: GraduationCap,
  cigam: BookOpen,
};

function getCollectionIcon(slug: string, icon: string): LucideIcon {
  return (getIconComponent(icon) as LucideIcon) || SLUG_ICON_MAP[slug] || COLLECTION_ICON_MAP[icon] || Folder;
}

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  is_group: boolean;
}

interface SidebarProps {
  cmsPages?: CmsPage[];
}

export function Sidebar({ cmsPages = [] }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { can, canModule, loading: permissionsLoading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function toggleExpand(name: string) {
    if (collapsed) return; // no expand when collapsed
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  return (
    <aside data-tour="sidebar" className={cn(
      "hidden md:flex flex-col bg-white border-r border-ink-50 transition-all duration-200 shrink-0",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo + collapse toggle */}
      {collapsed ? (
        <button
          onClick={toggleCollapsed}
          className="flex flex-col items-center gap-1.5 py-4 border-b border-ink-50 hover:bg-ink-50 transition-colors"
          title="Expandir menu"
        >
          <BrandLogo width={28} height={28} />
          <PanelLeftOpen size={12} className="text-ink-300" />
        </button>
      ) : (
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-50">
          <BrandLogo width={120} height={56} />
          <button
            onClick={toggleCollapsed}
            className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
            title="Recolher menu"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto pt-3", collapsed ? "px-1" : "px-2")}>
        {NAV_SECTIONS.map((section) => {
          // Hide everything while loading — prevents flash of unauthorized items
          if (permissionsLoading) return null;

          const visibleItems = section.items.filter((item) => {
            if (!canModule(item.module)) return false;
            if (item.action && !can(`${item.module}.${item.action}`)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
          <div key={section.label || "home"} className="mb-1.5">
            {!collapsed && section.label && (
              <span className="px-3 pt-4 pb-1 block text-xs font-medium text-ink-500">
                {section.label}
              </span>
            )}
            {collapsed && section.label && <div className="h-px bg-ink-100 mx-2 my-2" />}
            <div className="flex flex-col gap-px">
              {visibleItems.map((item) => {
                // Exact match for items that have sibling sub-routes (e.g. /pedidos vs /pedidos/gestao)
                const hasSubRoutes = section.items.some((other) => other !== item && other.href.startsWith(item.href + "/"));
                const isActive = hasSubRoutes ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/"));

                if (collapsed) {
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center rounded-lg h-10 w-full transition-colors group relative",
                        isActive ? "bg-brand-olive-soft text-brand-olive" : "text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                      )}
                      title={item.name}
                    >
                      <item.icon size={18} />
                      {/* Tooltip */}
                      <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-ink-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        {item.name}
                      </span>
                    </Link>
                  );
                }

                const hasChildren = false;
                const isExpanded = expandedItems.includes(item.name);

                const tourId = `nav-${item.href.replace(/\//g, "-").replace(/^-/, "")}`;

                return (
                  <div key={item.name} data-tour={tourId}>
                    <div
                      className={cn(
                        "flex items-center rounded-[9px] transition-colors",
                        isActive
                          ? "bg-ink-100 text-brand-olive font-medium"
                          : "text-ink-500 hover:bg-ink-50"
                      )}
                    >
                      <Link
                        href={item.href}
                        className="flex flex-1 items-center gap-2.5 px-3 h-[34px] text-sm"
                      >
                        <item.icon size={17} className={isActive ? "text-brand-olive" : "text-ink-500"} />
                        <span className="flex-1">{item.name}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}

        {/* CMS Pages — grouped, filtered by permissions */}
        {!permissionsLoading && cmsPages
          .filter((p) => p.is_group)
          .map((group) => {
            const children = cmsPages.filter((p) => p.parent_id === group.id && canModule(p.slug));
            if (children.length === 0) return null;

            return (
              <div key={group.slug} className="mb-1.5" data-tour="content-section">
                {!collapsed && (
                  <span className="px-3 pt-4 pb-1 block text-xs font-medium text-ink-500">
                    {group.title}
                  </span>
                )}
                {collapsed && <div className="h-px bg-ink-100 mx-2 my-2" />}
                <div className="flex flex-col gap-px">
                  {children.map((child) => {
                    const childActive = pathname === `/pagina/${child.slug}` || pathname.startsWith(`/pagina/${child.slug}/`);
                    const Icon = getCollectionIcon(child.slug, child.icon);
                    const subChildren = cmsPages.filter((p) => p.parent_id === child.id && !p.is_group);
                    const hasSubChildren = subChildren.length > 0;
                    const anySubActive = subChildren.some((sc) => pathname === `/pagina/${sc.slug}`);
                    const subExpanded = expandedItems.includes(`page-${child.slug}`) || anySubActive;

                    if (collapsed) {
                      return (
                        <Link
                          key={child.slug}
                          href={`/pagina/${child.slug}`}
                          className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-full transition-colors group relative",
                            childActive ? "bg-brand-olive-soft text-brand-olive" : "text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                          )}
                          title={child.title}
                        >
                          <Icon size={18} />
                          <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-ink-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            {child.title}
                          </span>
                        </Link>
                      );
                    }

                    return (
                      <div key={child.slug}>
                        <div className={cn(
                          "flex items-center rounded-[9px] transition-colors",
                          childActive ? "bg-ink-100 text-brand-olive font-medium" : "text-ink-500 hover:bg-ink-50"
                        )}>
                          <Link href={`/pagina/${child.slug}`} onClick={() => { if (hasSubChildren && !subExpanded) toggleExpand(`page-${child.slug}`); }} className="flex flex-1 items-center gap-2.5 px-3 h-[34px] text-sm">
                            <Icon size={17} className={childActive ? "text-brand-olive" : "text-ink-500"} />
                            <span>{child.title}</span>
                          </Link>
                          {hasSubChildren && (
                            <button onClick={() => toggleExpand(`page-${child.slug}`)} className="flex h-[34px] w-8 items-center justify-center">
                              <ChevronRight size={13} className={cn("transition-transform", childActive ? "text-brand-olive" : "text-ink-400", subExpanded && "rotate-90")} />
                            </button>
                          )}
                        </div>
                        {hasSubChildren && subExpanded && (
                          <div className="flex flex-col gap-px ml-6">
                            {subChildren.map((sc) => {
                              const scActive = pathname === `/pagina/${sc.slug}`;
                              return (
                                <Link key={sc.slug} href={`/pagina/${sc.slug}`} className={cn("flex items-center gap-2.5 rounded-[9px] px-3 h-[32px] text-sm transition-colors", scActive ? "bg-ink-100 text-brand-olive font-medium" : "text-ink-500 hover:bg-ink-50")}>
                                  <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", scActive ? "bg-brand-olive" : "bg-ink-300")} />
                                  <span>{sc.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </nav>

      {/* Footer */}
      <div className={cn("mt-auto border-t border-ink-100 px-4 py-3", collapsed && "px-2 py-2")}>
        <a
          href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza"
          target="_blank"
          rel="noopener noreferrer"
          className={cn("block text-center text-[10px] text-ink-300 hover:text-ink-500 transition-colors", collapsed && "text-[8px]")}
        >
          {collapsed ? "WC" : "construído por WaveCommerce"}
        </a>
      </div>
    </aside>
  );
}

