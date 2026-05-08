"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  inicio: "Início",
  usuarios: "Usuários",
  cms: "CMS",
  franquias: "Franquias",
  configuracoes: "Permissões",
  perfil: "Meu Perfil",
  templates: "Templates",
  "novo-pedido": "Novo Pedido",
  "gestao-de-pedidos": "Gestão de Pedidos",
  produtos: "Produtos",
  relatorios: "Relatórios",
  onboarding: "Onboarding",
  pagina: "",
  banners: "Banners",
  "categorias-materiais": "Categorias de Materiais",
  "categorias-campanhas": "Categorias de Campanhas",
  "assets-marca": "Assets da Marca",
  "materiais-pdv": "Materiais PDV",
  "posts-campanha": "Posts de Campanha",
  "posts-redes": "Posts Redes Sociais",
  fotos: "Fotos",
  "docs-cigam": "Documentação CIGAM",
  cursos: "Cursos",
  "universo-da-marca": "Universo da Marca",
  "material-corporativo": "Material Corporativo",
  campanhas: "Campanhas",
  "redes-sociais": "Redes Sociais",
  biblioteca: "Biblioteca",
  videos: "Vídeos",
  treinamento: "Treinamento",
  cigam: "CIGAM",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments
    .map((segment, i) => ({
      href: "/" + segments.slice(0, i + 1).join("/"),
      label: ROUTE_LABELS[segment],
      segment,
      isLast: i === segments.length - 1,
    }))
    .filter((c) => c.label !== "");

  // Mobile: show only last crumb
  // Desktop: show full path
  const lastCrumb = crumbs[crumbs.length - 1];

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 sm:gap-1.5 text-sm min-w-0">
      <Link
        href="/inicio"
        className="text-ink-400 hover:text-ink-700 transition-colors shrink-0 flex items-center justify-center h-7 w-7 sm:h-auto sm:w-auto"
        aria-label="Início"
      >
        <Home size={14} />
      </Link>

      {/* Mobile: only last segment */}
      {lastCrumb && (
        <span className="flex sm:hidden items-center gap-1 min-w-0">
          <ChevronRight size={11} className="text-ink-300 shrink-0" />
          <span className="font-medium text-ink-900 truncate text-xs">{lastCrumb.label || lastCrumb.segment}</span>
        </span>
      )}

      {/* Desktop: full breadcrumb */}
      <span className="hidden sm:flex items-center gap-1.5 min-w-0">
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight size={12} className="text-ink-300 shrink-0" />
            {crumb.isLast ? (
              <span className="font-medium text-ink-900 truncate">{crumb.label || crumb.segment}</span>
            ) : (
              <Link href={crumb.href} className="text-ink-400 hover:text-ink-700 transition-colors shrink-0">
                {crumb.label || crumb.segment}
              </Link>
            )}
          </span>
        ))}
      </span>
    </nav>
  );
}
