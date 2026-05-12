"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

export async function getAuditLog(filters?: {
  entityType?: string;
  action?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const p = await requirePermission("historico", "view"); if (p.error) return { entries: [], total: 0 };
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.userId) query = query.eq("user_id", filters.userId);

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;
  return { entries: data || [], total: count || 0 };
}
