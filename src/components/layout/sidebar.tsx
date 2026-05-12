"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Folder } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { getIconComponent } from "@/components/ui/icon-picker";
import { useState, useEffect } from "react";

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

interface SidebarProps {
  cmsPages?: CmsPage[];
}

function resolveHref(page: CmsPage): string {
  if (page.page_type === "system" && page.href) return page.href;
  return `/pagina/${page.slug}`;
}

function resolveIcon(page: CmsPage) {
  return getIconComponent(page.icon) || Folder;
}

export function Sidebar({ cmsPages = [] }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { can, canModule, loading: permissionsLoading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function toggleExpand(key: string) {
    if (collapsed) return;
    setExpandedItems((prev) =>
      prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key]
    );
  }

  // Permission check for a page
  function canViewPage(page: CmsPage): boolean {
    if (page.page_type === "system") {
      if (!page.module) return true;
      if (!canModule(page.module)) return false;
      if (page.required_action && !can(`${page.module}.${page.required_action}`)) return false;
      return true;
    }
    // CMS pages: check by slug (module = slug in permissions)
    return canModule(page.slug);
  }

  // Build sections: root pages (no parent, not groups) + groups with children
  const groups = cmsPages.filter((p) => p.is_group);
  const rootPages = cmsPages.filter((p) => !p.parent_id && !p.is_group);

  function isActive(page: CmsPage, siblings: CmsPage[]): boolean {
    const href = resolveHref(page);
    const hasSiblingSubRoute = siblings.some((s) => s !== page && resolveHref(s).startsWith(href + "/"));
    return hasSiblingSubRoute ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
  }

  function renderCollapsedItem(page: CmsPage, active: boolean) {
    const Icon = resolveIcon(page);
    const href = resolveHref(page);
    return (
      <Link
        key={page.id}
        href={href}
        className={cn(
          "flex items-center justify-center rounded-lg h-10 w-full transition-colors group relative",
          active ? "bg-brand-olive-soft text-brand-olive" : "text-ink-400 hover:bg-ink-50 hover:text-ink-700"
        )}
        title={page.title}
      >
        <Icon size={18} />
        <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-ink-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {page.title}
        </span>
      </Link>
    );
  }

  function renderExpandedItem(page: CmsPage, active: boolean) {
    const Icon = resolveIcon(page);
    const href = resolveHref(page);

    // Check for sub-children (non-group children of this page)
    const subChildren = cmsPages.filter((p) => p.parent_id === page.id && !p.is_group);
    const visibleSubChildren = subChildren.filter(canViewPage);
    const hasSubChildren = visibleSubChildren.length > 0;
    const anySubActive = visibleSubChildren.some((sc) => {
      const scHref = resolveHref(sc);
      return pathname === scHref || pathname.startsWith(scHref + "/");
    });
    const subExpanded = expandedItems.includes(`page-${page.id}`) || anySubActive;

    const tourId = page.page_type === "system"
      ? `nav-${(page.href || page.slug).replace(/\//g, "-").replace(/^-/, "")}`
      : `nav-p-${page.slug}`;

    return (
      <div key={page.id} data-tour={tourId}>
        <div
          className={cn(
            "flex items-center rounded-[9px] transition-colors",
            active ? "bg-ink-100 text-brand-olive font-medium" : "text-ink-500 hover:bg-ink-50"
          )}
        >
          <Link
            href={href}
            onClick={() => { if (hasSubChildren && !subExpanded) toggleExpand(`page-${page.id}`); }}
            className="flex flex-1 items-center gap-2.5 px-3 h-[34px] text-sm"
          >
            <Icon size={17} className={active ? "text-brand-olive" : "text-ink-500"} />
            <span className="flex-1">{page.title}</span>
          </Link>
          {hasSubChildren && (
            <button onClick={() => toggleExpand(`page-${page.id}`)} className="flex h-[34px] w-8 items-center justify-center">
              <ChevronRight size={13} className={cn("transition-transform", active ? "text-brand-olive" : "text-ink-400", subExpanded && "rotate-90")} />
            </button>
          )}
        </div>
        {hasSubChildren && subExpanded && (
          <div className="flex flex-col gap-px ml-6">
            {visibleSubChildren.map((sc) => {
              const scHref = resolveHref(sc);
              const scActive = pathname === scHref || pathname.startsWith(scHref + "/");
              return (
                <Link key={sc.id} href={scHref} className={cn("flex items-center gap-2.5 rounded-[9px] px-3 h-[32px] text-sm transition-colors", scActive ? "bg-ink-100 text-brand-olive font-medium" : "text-ink-500 hover:bg-ink-50")}>
                  <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", scActive ? "bg-brand-olive" : "bg-ink-300")} />
                  <span>{sc.title}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderSection(group: CmsPage | null, children: CmsPage[]) {
    const visible = children.filter(canViewPage);
    if (visible.length === 0) return null;

    const key = group ? group.id : "root";
    const label = group?.title || "";

    return (
      <div key={key} className="mb-1.5" data-tour={group ? `section-${group.slug}` : "home-section"}>
        {!collapsed && label && (
          <span className="px-3 pt-4 pb-1 block text-xs font-medium text-ink-500">
            {label}
          </span>
        )}
        {collapsed && label && <div className="h-px bg-ink-100 mx-2 my-2" />}
        <div className="flex flex-col gap-px">
          {visible.map((page) => {
            const active = isActive(page, visible);
            return collapsed
              ? renderCollapsedItem(page, active)
              : renderExpandedItem(page, active);
          })}
        </div>
      </div>
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
        {permissionsLoading && (
          <div className={cn("flex flex-col gap-1", collapsed ? "px-1" : "px-2")}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("rounded-[9px] bg-ink-50 animate-pulse", collapsed ? "h-10 w-full" : "h-[34px] w-full")} />
            ))}
          </div>
        )}
        {!permissionsLoading && (
          <>
            {/* Root pages (no group) */}
            {rootPages.length > 0 && renderSection(null, rootPages)}

            {/* Grouped sections */}
            {groups.map((group) => {
              const children = cmsPages.filter((p) => p.parent_id === group.id && !p.is_group);
              return renderSection(group, children);
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("mt-auto border-t border-ink-100 px-4 py-3 space-y-1", collapsed && "px-2 py-2")}>
        <a
          href="https://essenza.betteruptime.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn("flex items-center justify-center gap-1.5 text-[10px] text-ink-300 hover:text-ink-500 transition-colors", collapsed && "text-[8px]")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          {!collapsed && "Status dos serviços"}
        </a>
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
