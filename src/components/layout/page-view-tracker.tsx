"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/app/(dashboard)/analytics-actions";

const MODULE_MAP: Record<string, string> = {
  "/inicio": "inicio",
  "/pedidos": "pedidos",
  "/novo-pedido": "pedidos",
  "/franquias": "franquias",
  "/usuarios": "usuarios",
  "/comunicados": "comunicados",
  "/faq": "faq",
  "/pesquisas": "pesquisas",
  "/relatorios": "relatorios",
  "/biblioteca": "biblioteca",
  "/configuracoes": "configuracoes",
  "/cms": "cms",
  "/templates": "templates",
};

function resolveModule(path: string): string {
  // Direct match
  if (MODULE_MAP[path]) return MODULE_MAP[path];

  // Prefix match for sub-routes (e.g., /pedidos/123)
  for (const [prefix, mod] of Object.entries(MODULE_MAP)) {
    if (path.startsWith(prefix + "/")) return mod;
  }

  // CMS pages: /pagina/[slug] → slug is the module
  const pageMatch = path.match(/^\/pagina\/([^/]+)/);
  if (pageMatch) return pageMatch[1];

  return "outro";
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("pv_session");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("pv_session", sid);
  }
  return sid;
}

export function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    // Debounce: don't re-track same path
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    const module = resolveModule(pathname);
    const sessionId = getSessionId();
    trackPageView(pathname, module, document.title, sessionId);
  }, [pathname]);

  return null;
}
