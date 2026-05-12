// Dev view mode — simulates different user roles for testing
// Uses cookie so it works on both server and client

export type DevViewMode = "admin" | "franchise_owner" | "franchise_user" | "commercial" | "";

export interface DevPermission {
  module: string;
  action: string;
}

const ALL_MODULES = [
  "dashboard", "usuarios", "franquias", "cms", "configuracoes",
  "templates", "pedidos", "produtos", "relatorios", "comunicados", "historico",
  "universo-da-marca", "material-corporativo", "campanhas",
  "redes-sociais", "biblioteca", "videos", "treinamento", "cigam",
];

const ALL_ACTIONS = ["view", "create", "edit", "delete", "download", "manage"];

function allPerms(modules: string[], actions: string[]): DevPermission[] {
  return modules.flatMap((m) => actions.map((a) => ({ module: m, action: a })));
}

export const DEV_PRESETS: Record<string, DevPermission[]> = {
  admin: allPerms(ALL_MODULES, ALL_ACTIONS),
  franchise_owner: [
    ...allPerms(["dashboard", "universo-da-marca", "material-corporativo", "campanhas", "redes-sociais", "biblioteca", "videos", "treinamento"], ["view", "download"]),
    ...allPerms(["templates"], ["view", "download"]),
    ...allPerms(["pedidos"], ["view", "create"]),
    { module: "usuarios", action: "view" },
  ],
  franchise_user: [
    ...allPerms(["dashboard", "universo-da-marca", "material-corporativo", "campanhas", "redes-sociais", "biblioteca", "videos", "treinamento"], ["view", "download"]),
    ...allPerms(["templates"], ["view", "download"]),
    ...allPerms(["pedidos"], ["view", "create"]),
  ],
  commercial: [
    ...allPerms(["dashboard"], ["view"]),
    ...allPerms(["campanhas", "material-corporativo"], ["view", "create", "edit", "download"]),
    ...allPerms(["cms"], ["view", "create", "edit"]),
    ...allPerms(["pedidos"], ["view", "manage"]),
    ...allPerms(["relatorios"], ["view"]),
  ],
};

export const DEV_COOKIE_NAME = "dev-view-mode";

// Server-side: read from cookies
export function getDevModeFromCookies(cookieHeader: string | null): DevViewMode {
  if (process.env.NODE_ENV !== "development" || !cookieHeader) return "";
  const match = cookieHeader.match(new RegExp(`${DEV_COOKIE_NAME}=([^;]+)`));
  return (match?.[1] || "") as DevViewMode;
}

// Check if a dev mode is active and return permissions, or null to use real perms
export function getDevPermissions(mode: DevViewMode): DevPermission[] | null {
  if (!mode || !DEV_PRESETS[mode]) return null;
  return DEV_PRESETS[mode];
}

// Helper: check if dev mode grants a specific permission
export function devCan(mode: DevViewMode, key: string): boolean {
  const perms = getDevPermissions(mode);
  if (!perms) return true; // no dev mode = use real perms
  const [module, action] = key.split(".");
  return perms.some((p) => p.module === module && p.action === action);
}

// Helper: check if dev mode is admin
export function devIsAdmin(mode: DevViewMode): boolean {
  return mode === "admin" || mode === "";
}
