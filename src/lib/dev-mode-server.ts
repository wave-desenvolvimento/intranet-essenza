import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEV_COOKIE_NAME, DEV_PRESETS, type DevViewMode, type DevPermission } from "./dev-mode";

const DEV_ALLOWED_EMAIL = "wesley@wavecommerce.com.br";

// Server-only: read dev mode from request cookies (only if allowed user)
async function getServerDevMode(): Promise<DevViewMode> {
  if (process.env.NODE_ENV !== "development") return "";
  const store = await cookies();
  const mode = store.get(DEV_COOKIE_NAME)?.value as DevViewMode;
  if (!mode) return "";

  // Check if current user is allowed
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== DEV_ALLOWED_EMAIL) return "";

  return mode;
}

// Server-only: check if current dev mode is admin
export async function isServerAdmin(realPermKeys: string[]): Promise<boolean> {
  const mode = await getServerDevMode();
  if (mode === "") return realPermKeys.includes("configuracoes.manage") || realPermKeys.includes("cms.create");
  return mode === "admin";
}

// Server-only: get permission keys (dev or real)
export async function getEffectivePermissions(realPermKeys: string[]): Promise<string[]> {
  const mode = await getServerDevMode();
  if (!mode || !DEV_PRESETS[mode]) return realPermKeys;
  return DEV_PRESETS[mode].map((p) => `${p.module}.${p.action}`);
}
