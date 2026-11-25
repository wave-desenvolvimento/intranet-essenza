// Dev view mode - simulates different user roles for testing
// Uses cookie so it works on both server and client

export type DevViewMode = "admin" | "franchise_owner" | "franchise_user" | "commercial" | "";

export interface DevPermission {
  module: string;
  action: string;
}

const MODULE_ACTIONS: Record<string, string[]> = {
  dashboard:            ["view"],
  usuarios:             ["view", "create", "edit", "delete", "manage"],
  treinamentos:         ["view", "manage"],
  franquias:            ["view", "create", "edit", "delete"],
  cms:                  ["view", "create", "edit", "delete"],
  templates:            ["view", "create", "edit", "delete"],
  pedidos:              ["view", "view_all", "create", "edit", "approve", "export", "manage"],
  produtos:             ["view", "edit", "delete"],
  relatorios:           ["view", "export"],
  comunicados:          ["view", "create", "edit", "delete"],
  historico:            ["view"],
  faq:                  ["view", "create", "edit", "delete"],
  pesquisas:            ["view", "create", "edit", "delete"],
  leads:                ["view", "edit", "delete", "export"],
  biblioteca:           ["view", "download"],
  suporte:              ["view", "create", "edit", "delete"],
  configuracoes:        ["view", "edit"],
  "universo-da-marca":  ["view", "create", "edit", "download"],
  "material-corporativo": ["view", "create", "edit", "download"],
  campanhas:            ["view", "create", "edit", "download"],
  "redes-sociais":      ["view", "create", "edit", "download"],
  videos:               ["view", "create", "edit", "download"],
  treinamento:          ["view", "create", "edit", "download"],
  cigam:                ["view", "create", "edit", "download"],
  fotos:                ["view", "create", "edit", "download"],
};

function allPerms(modules: string[], actions: string[]): DevPermission[] {
  return modules.flatMap((m) => actions.map((a) => ({ module: m, action: a })));
}

function allModulePerms(): DevPermission[] {
  return Object.entries(MODULE_ACTIONS).flatMap(([m, actions]) =>
    actions.map((a) => ({ module: m, action: a }))
  );
}

export const DEV_PRESETS: Record<string, DevPermission[]> = {
  admin: allModulePerms(),
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

