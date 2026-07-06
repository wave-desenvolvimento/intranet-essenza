"use server";

import { createClient } from "@/lib/supabase/server";
import {
  notifyUsers as _notifyUsers,
  notifyByPermission as _notifyByPermission,
  notifyFranchise as _notifyFranchise,
} from "@/lib/notify";

// ---- Thin wrappers (keep existing call-sites working) ----

interface NotifyParams {
  title: string;
  body?: string;
  href?: string;
  icon?: string;
}

export async function notifyUsers(userIds: string[], params: NotifyParams) {
  await _notifyUsers({ userIds, notification: params });
}

export async function notifyByPermission(module: string, action: string, params: NotifyParams, excludeUserId?: string) {
  await _notifyByPermission({ module, action, notification: params, excludeUserId });
}

export async function notifyFranchise(franchiseId: string, params: NotifyParams, excludeUserId?: string) {
  await _notifyFranchise({ franchiseId, notification: params, excludeUserId });
}

// ---- Read / Update ----

export async function getNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return data || [];
}

export async function getUnreadCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return count || 0;
}

export async function markAsRead(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  return { success: true };
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return { success: true };
}
