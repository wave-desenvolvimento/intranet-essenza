"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { DEV_PRESETS, DEV_COOKIE_NAME, type DevPermission } from "@/lib/dev-mode";

interface Permission {
  module: string;
  action: string;
}

function getDevMode(): string | null {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return null;
  // Read from cookie (synced with server)
  const match = document.cookie.match(new RegExp(`${DEV_COOKIE_NAME}=([^;]+)`));
  return match?.[1] || null;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Dev mode override — only for Wesley
      const devMode = getDevMode();
      if (devMode && DEV_PRESETS[devMode] && user?.email === "wesley@wavecommerce.com.br") {
        setPermissions(DEV_PRESETS[devMode]);
        setLoading(false);
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.rpc("get_user_permissions", {
        _user_id: user.id,
      });

      if (data) setPermissions(data as Permission[]);
      setLoading(false);
    }

    load();

    // Listen for dev mode changes (before reload)
    function onModeChange() { load(); }
    window.addEventListener("dev-view-mode-change", onModeChange);
    return () => window.removeEventListener("dev-view-mode-change", onModeChange);
  }, []);

  function can(key: string): boolean {
    const [module, action] = key.split(".");
    return permissions.some((p) => p.module === module && p.action === action);
  }

  function canModule(module: string): boolean {
    return permissions.some((p) => p.module === module);
  }

  return { can, canModule, permissions, loading };
}
