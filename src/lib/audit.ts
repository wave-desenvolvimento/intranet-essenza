"use server";

import { createClient } from "@/lib/supabase/server";

interface AuditEntry {
  action: "create" | "update" | "delete" | "approve" | "invite" | "login";
  entityType: string;
  entityId?: string;
  description: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

export async function logAudit(entry: AuditEntry) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get user name
    let userName = user?.email || "Sistema";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) userName = profile.full_name;
    }

    await supabase.from("audit_log").insert({
      user_id: user?.id || null,
      user_name: userName,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      description: entry.description,
      changes: entry.changes || null,
    });
  } catch {
    // Audit log should never break the main operation
  }
}
