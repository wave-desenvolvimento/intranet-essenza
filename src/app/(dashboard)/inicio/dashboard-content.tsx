"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  FileText,
  Users,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Star,
  ShoppingCart,
  DollarSign,
  Clock,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BannerRenderer } from "@/components/ui/banner-renderer";
import type { BannerOverlay } from "@/components/ui/banner-template-editor";

interface BannerData {
  id: string;
  data: Record<string, unknown>;
}

interface CmsItem {
  id: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface FavoriteData {
  id: string;
  item: { id: string; data: Record<string, unknown>; status: string; collection_id: string } | null;
  collection: { name: string; slug: string; view_type: string } | null;
}

interface Props {
  userName: string;
  franchiseName?: string;
  permissions: string[];
  banners: BannerData[];
  stats: {
    activeUsers: number;
    activeFranchises: number;
    campaigns: number;
    materials: number;
  };
  recentMaterials: CmsItem[];
  recentPromotions: CmsItem[];
  recentSocial: CmsItem[];
  favorites?: FavoriteData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  franchiseData?: any;
  orderStats?: {
    pendingCount: number;
    monthRevenue: number;
    recentOrders: { id: string; status: string; total: number; created_at: string; franchise_name: string }[];
  };
  isOrderAdmin?: boolean;
  announcements?: { id: string; title: string; body: string; priority: string; banner_url: string | null; created_at: string; target_type: string }[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function can(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function canAny(permissions: string[], module: string): boolean {
  return permissions.some((p) => p.startsWith(`${module}.`));
}


function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isRecent(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // 7 dias
}

function getItemTitle(item: CmsItem): string {
  return String(item.data.titulo || item.data.title || item.data.nome || "");
}

function getItemDesc(item: CmsItem): string {
  const raw = String(item.data.descricao || item.data.description || "");
  return raw.replace(/<[^>]*>/g, "").trim();
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  enviado: { label: "Enviado", color: "text-info", bg: "bg-info-soft" },
  aprovado: { label: "Aprovado", color: "text-success", bg: "bg-success-soft" },
  separacao: { label: "Separação", color: "text-warning", bg: "bg-warning-soft" },
  faturado: { label: "Faturado", color: "text-brand-olive", bg: "bg-brand-olive-soft" },
  cancelado: { label: "Cancelado", color: "text-danger", bg: "bg-danger-soft" },
};

function formatPrice(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

import { Pin, AlertTriangle } from "lucide-react";

export function DashboardContent({ userName, franchiseName, permissions, banners, stats, recentMaterials, recentPromotions, recentSocial, favorites = [], franchiseData, orderStats, isOrderAdmin, announcements = [] }: Props) {
  const [campaignIndex, setCampaignIndex] = useState(0);

  const greeting = getGreeting();
  const firstName = userName.split(" ")[0];

  const showCampaigns = canAny(permissions, "campanhas");
  const showMaterials = canAny(permissions, "material-corporativo");
  const showPromotions = canAny(permissions, "campanhas");
  const showSocial = canAny(permissions, "redes-sociais");
  const showUserStats = can(permissions, "usuarios.view");
  const canCreateMaterial = can(permissions, "material-corporativo.create");

  // Stats cards config
  const showOrders = canAny(permissions, "pedidos");

  const statCards = [
    ...(orderStats && orderStats.pendingCount > 0 ? [{
      label: "Pedidos pendentes",
      value: String(orderStats.pendingCount),
      change: "aguardando ação",
      positive: false,
      icon: Clock,
      visible: showOrders,
    }] : []),
    ...(isOrderAdmin && orderStats && orderStats.monthRevenue > 0 ? [{
      label: "Faturamento do mês",
      value: formatPrice(orderStats.monthRevenue),
      change: "pedidos no período",
      positive: true,
      icon: DollarSign,
      visible: true,
    }] : []),
    {
      label: "Campanhas",
      value: String(stats.campaigns),
      change: `${recentPromotions.length} recentes`,
      positive: stats.campaigns > 0,
      icon: Megaphone,
      visible: showCampaigns,
    },
    {
      label: "Materiais",
      value: String(stats.materials),
      change: `${recentMaterials.length} recentes`,
      positive: stats.materials > 0,
      icon: FileText,
      visible: showMaterials,
    },
    {
      label: "Usuários ativos",
      value: String(stats.activeUsers),
      change: franchiseName ? franchiseName : `${stats.activeFranchises} franquias`,
      positive: true,
      icon: Users,
      visible: showUserStats,
    },
  ];

  const visibleStats = statCards.filter((s) => s.visible);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-ink-900">
            {greeting}, {firstName}
          </h1>
          <p className="text-xs md:text-sm text-ink-500 mt-0.5">
            Confira as novidades e acesse seus materiais.
          </p>
        </div>
        {canCreateMaterial && (
          <div className="flex items-center gap-2 self-start sm:self-auto hidden sm:flex">
            <Link
              href="/material-corporativo"
              className="flex items-center gap-2 rounded-[9px] bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
            >
              <Plus size={14} />
              Novo material
            </Link>
            <button className="flex items-center gap-2 rounded-[9px] border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:bg-ink-50 transition-colors">
              <Upload size={14} />
              Exportar
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {visibleStats.length > 0 && (
        <div className={cn("grid gap-3", visibleStats.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-" + Math.min(visibleStats.length, 5))}>
          {visibleStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-ink-100 bg-white px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-ink-500 truncate">{s.label}</span>
                <s.icon size={14} className={s.positive ? "text-brand-olive" : "text-warning"} />
              </div>
              <p className="text-lg font-semibold text-ink-900 truncate">{s.value}</p>
              <p className="text-[10px] text-ink-400 truncate">{s.change}</p>
            </div>
          ))}
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => {
            const isUrgent = a.priority === "urgent";
            const isPinned = a.priority === "pinned";
            const PriorityIcon = isPinned ? Pin : isUrgent ? AlertTriangle : Megaphone;
            const priorityColor = isPinned ? "text-brand-olive" : isUrgent ? "text-danger" : "text-info";
            const priorityBg = isPinned ? "bg-brand-olive-soft" : isUrgent ? "bg-danger-soft" : "bg-info-soft";
            return (
              <Link key={a.id} href="/comunicados" className="group rounded-xl border border-ink-100 bg-white overflow-hidden hover:border-brand-olive/30 transition-colors">
                {a.banner_url && (
                  <div className="w-full h-28 sm:h-36 overflow-hidden">
                    <img src={a.banner_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5", priorityBg)}>
                    <PriorityIcon size={14} className={priorityColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900 group-hover:text-brand-olive transition-colors">{a.title}</p>
                      {(isUrgent || isPinned) && (
                        <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium", priorityBg, priorityColor)}>
                          {isPinned ? "Fixado" : "Urgente"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 line-clamp-1 mt-0.5">{a.body.replace(/<[^>]*>/g, "").slice(0, 120)}</p>
                  </div>
                  <span className="text-[10px] text-ink-400 shrink-0 mt-1">{new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Banners Carousel (from CMS) */}
      {showCampaigns && banners.length > 0 && (
        <div className="relative rounded-[14px] overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${campaignIndex * 100}%)` }}
          >
            {banners.map((banner) => {
              const d = banner.data;
              const corInicio = String(d.cor_inicio || "");
              const corFim = String(d.cor_fim || "");
              const imgDesktop = String(d.imagem_desktop || "");
              const imgMobile = String(d.imagem_mobile || "");
              const badge = String(d.badge || "");
              const titulo = String(d.titulo || "");
              const descricao = String(d.descricao || "");
              const ctaTexto = String(d.cta_texto || "");
              const ctaLink = String(d.cta_link || "");
              const templateOverlays = (d._overlays as BannerOverlay[]) || [];
              const hasTemplate = templateOverlays.length > 0 && franchiseData;

              const hasGradient = corInicio && corFim;
              const hasImage = imgDesktop || imgMobile;
              const isEmpty = !hasImage && !hasGradient;

              const desktopBg: React.CSSProperties = imgDesktop
                ? { backgroundImage: `url(${imgDesktop})`, backgroundSize: "cover", backgroundPosition: "center" }
                : hasGradient
                  ? { background: `linear-gradient(135deg, ${corInicio}, ${corFim})` }
                  : {};

              const mobileBg: React.CSSProperties = imgMobile
                ? { backgroundImage: `url(${imgMobile})`, backgroundSize: "cover", backgroundPosition: "center" }
                : imgDesktop
                  ? { backgroundImage: `url(${imgDesktop})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : hasGradient
                    ? { background: `linear-gradient(135deg, ${corInicio}, ${corFim})` }
                    : {};

              // Personalized banner with franchise data
              if (hasTemplate) {
                const gradient = hasGradient ? `linear-gradient(135deg, ${corInicio}, ${corFim})` : undefined;
                const templateContent = (
                  <div className="min-w-full">
                    <BannerRenderer
                      overlays={templateOverlays}
                      franchise={franchiseData}
                      backgroundImage={imgDesktop || undefined}
                      backgroundGradient={gradient}
                      className="min-w-full"
                      aspectRatio="16/5"
                    />
                  </div>
                );
                if (ctaLink) {
                  return <Link key={banner.id} href={ctaLink} className="min-w-full block">{templateContent}</Link>;
                }
                return <div key={banner.id} className="min-w-full">{templateContent}</div>;
              }

              const content = (
                <>
                  {/* Desktop */}
                  <div
                    className={cn("hidden md:block min-w-full h-[220px] rounded-[14px] relative overflow-hidden", isEmpty && "bg-ink-200")}
                    style={desktopBg}
                  >
                    {!isEmpty && <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />}
                    <BannerTextOverlay badge={badge} titulo={titulo} descricao={descricao} ctaTexto={ctaTexto} isEmpty={isEmpty} />
                  </div>
                  {/* Mobile */}
                  <div
                    className={cn("md:hidden min-w-full h-[280px] rounded-[14px] relative overflow-hidden", isEmpty && "bg-ink-200")}
                    style={mobileBg}
                  >
                    {!isEmpty && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />}
                    <BannerTextOverlay badge={badge} titulo={titulo} descricao={descricao} ctaTexto={ctaTexto} isEmpty={isEmpty} mobile />
                  </div>
                </>
              );

              if (ctaLink) {
                return <Link key={banner.id} href={ctaLink} className="min-w-full block">{content}</Link>;
              }
              return <div key={banner.id} className="min-w-full">{content}</div>;
            })}
          </div>

          {/* Carousel controls */}
          {banners.length > 1 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                {banners.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-[3px] rounded-full transition-all",
                      i === campaignIndex ? "w-8 bg-white" : "w-5 bg-white/50"
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => setCampaignIndex((prev) => Math.max(0, prev - 1))}
                disabled={campaignIndex === 0}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-ink-900 hover:bg-white disabled:opacity-40 transition-colors"
                title="Anterior"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setCampaignIndex((prev) => Math.min(banners.length - 1, prev + 1))}
                disabled={campaignIndex === banners.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-ink-900 hover:bg-white disabled:opacity-40 transition-colors"
                title="Próximo"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Favorites quick access */}
      {favorites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-brand-olive" />
            <h3 className="text-sm font-semibold text-ink-900">Favoritos</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
            {favorites.slice(0, 5).map((fav) => {
              if (!fav.item || !fav.collection) return null;
              const title = String(fav.item.data.titulo || fav.item.data.title || fav.item.data.nome || "");
              const img = String(fav.item.data.imagem || fav.item.data.imagem_desktop || fav.item.data.image || "");
              const pageSlug = fav.collection.slug;

              return (
                <Link
                  key={fav.id}
                  href={`/pagina/${pageSlug}`}
                  className="rounded-xl border border-ink-100 bg-white overflow-hidden hover:border-ink-200 transition-colors group min-w-[140px] sm:min-w-0 shrink-0 sm:shrink"
                >
                  {img ? (
                    <div className="aspect-video bg-ink-50 overflow-hidden">
                      <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-ink-50 flex items-center justify-center">
                      <FileText size={20} className="text-ink-300" />
                    </div>
                  )}
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-ink-900 truncate">{title || "Sem título"}</p>
                    <p className="text-[10px] text-ink-400">{fav.collection.name}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {showOrders && orderStats && orderStats.recentOrders.length > 0 && (
        <DashboardTable
          title="Pedidos Recentes"
          linkHref={isOrderAdmin ? "/gestao-de-pedidos" : "/novo-pedido"}
          columns={isOrderAdmin ? ["Pedido", "Franquia", "Status", "Total"] : ["Pedido", "Status", "Total"]}
          fullWidth
        >
          {orderStats.recentOrders.map((o) => {
            const cfg = STATUS_LABELS[o.status] || { label: o.status, color: "text-ink-500", bg: "bg-ink-100" };
            return (
              <tr key={o.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-mono text-xs font-medium text-ink-900">#{o.id.slice(0, 8)}</p>
                  <p className="text-[10px] text-ink-400">{formatDate(o.created_at)}</p>
                </td>
                {isOrderAdmin && (
                  <td className="px-3.5 py-3 text-sm text-ink-600">{o.franchise_name}</td>
                )}
                <td className="px-3.5 py-3">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.color)}>{cfg.label}</span>
                </td>
                <td className="px-3.5 py-3 text-sm font-semibold text-ink-900 text-right">{formatPrice(o.total)}</td>
              </tr>
            );
          })}
        </DashboardTable>
      )}

      {/* Materials Table */}
      {showMaterials && recentMaterials.length > 0 && (
        <DashboardTable
          title="Material Publicitário"
          linkHref="/pagina/material-corporativo"
          columns={["Título", "Descrição", "Data"]}
          fullWidth
        >
          {recentMaterials.map((m) => (
            <tr key={m.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">{getItemTitle(m)}</span>
                  {isRecent(m.created_at) && (
                    <span className="rounded-[9px] bg-brand-olive px-2 py-0.5 text-[10px] font-medium text-white">
                      novo
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3.5 py-3.5 text-sm text-ink-500 max-w-[300px] truncate hidden sm:table-cell">{getItemDesc(m)}</td>
              <td className="px-3.5 py-3.5 text-xs sm:text-sm text-ink-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
            </tr>
          ))}
        </DashboardTable>
      )}

      {/* Bottom row: two tables side by side */}
      {(showPromotions && recentPromotions.length > 0 || showSocial && recentSocial.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {showPromotions && recentPromotions.length > 0 && (
            <DashboardTable
              title="Campanhas"
              linkHref="/pagina/campanhas"
              columns={["Título", "Data"]}
            >
              {recentPromotions.map((p) => (
                <tr key={p.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{getItemTitle(p)}</span>
                      {isRecent(p.created_at) && (
                        <span className="rounded-[9px] bg-brand-olive px-2 py-0.5 text-[10px] font-medium text-white">
                          novo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3.5 py-3.5 text-sm text-ink-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}

          {showSocial && recentSocial.length > 0 && (
            <DashboardTable
              title="Redes Sociais"
              linkHref="/pagina/redes-sociais"
              columns={["Título", "Data"]}
            >
              {recentSocial.map((s) => (
                <tr key={s.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-ink-900">{getItemTitle(s)}</td>
                  <td className="px-3.5 py-3.5 text-sm text-ink-500">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </DashboardTable>
          )}
        </div>
      )}
    </div>
  );
}

// Reusable table wrapper
function DashboardTable({
  title,
  linkHref,
  columns,
  fullWidth,
  children,
}: {
  title: string;
  linkHref: string;
  columns: string[];
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-ink-50 bg-white overflow-hidden", fullWidth && "w-full")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-ink-100">
        <h3 className="text-sm md:text-base font-semibold text-ink-900">{title}</h3>
        <Link
          href={linkHref}
          className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors"
        >
          Ver todos
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "px-4 md:px-5 py-2.5 text-xs font-medium text-ink-400",
                    col === "Ações" ? "text-right" : "text-left",
                    col === "Descrição" && "hidden sm:table-cell"
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// Banner overlay content
function BannerTextOverlay({ badge, titulo, descricao, ctaTexto, isEmpty, mobile }: { badge: string; titulo: string; descricao: string; ctaTexto: string; isEmpty: boolean; mobile?: boolean }) {
  return (
    <div className={cn("relative z-10 flex flex-col h-full", mobile ? "justify-end px-6 pb-6" : "justify-center px-12 max-w-md")}>
      {badge && (
        <span className="inline-flex self-start rounded-full border border-white/80 px-3 py-1 text-xs font-medium text-white mb-3">
          {badge}
        </span>
      )}
      {titulo && <h2 className={cn(mobile ? "text-xl" : "text-2xl", "font-semibold", isEmpty ? "text-ink-700" : "text-white")}>{titulo}</h2>}
      {descricao && <p className={cn("text-sm mt-2", isEmpty ? "text-ink-500" : "text-white/80")}>{descricao}</p>}
      {ctaTexto && (
        <span className="inline-flex items-center gap-2 self-start mt-4 rounded-[7px] bg-white px-4 py-2 text-sm font-medium text-ink-900">
          {ctaTexto}
          <ArrowRight size={12} />
        </span>
      )}
    </div>
  );
}

