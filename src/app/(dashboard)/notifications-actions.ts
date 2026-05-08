"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push";

// ---- Helper: create notifications for multiple users ----

interface NotifyParams {
  title: string;
  body?: string;
  href?: string;
  icon?: string;
}

/** Notify specific users by ID — creates in-app notification + sends push */
export async function notifyUsers(userIds: string[], params: NotifyParams) {
  if (userIds.length === 0) return;
  const supabase = await createClient();
  const rows = userIds.map((uid) => ({
    user_id: uid,
    title: params.title,
    body: params.body || null,
    href: params.href || null,
    icon: params.icon || "bell",
  }));
  await supabase.from("notifications").insert(rows);

  // Also send push notification (non-blocking)
  sendPushToUsers(userIds, {
    title: params.title,
    body: params.body,
    href: params.href,
  }).catch(() => {});
}

/** Notify all active users with a specific permission */
export async function notifyByPermission(module: string, action: string, params: NotifyParams, excludeUserId?: string) {
  const supabase = await createClient();

  // Get user IDs that have this permission via their roles
  const { data: users } = await supabase
    .from("profiles")
    .select("id, user_roles!inner(role_id, role:roles!inner(id, permissions!inner(module, action)))")
    .eq("status", "active")
    .eq("user_roles.role.permissions.module", module)
    .eq("user_roles.role.permissions.action", action);

  const userIds = (users || [])
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);

  if (userIds.length === 0) return;
  await notifyUsers(userIds, params);
}

/** Notify all users of a specific franchise */
export async function notifyFranchise(franchiseId: string, params: NotifyParams, excludeUserId?: string) {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .eq("franchise_id", franchiseId)
    .eq("status", "active");

  const userIds = (users || [])
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);

  if (userIds.length === 0) return;
  await notifyUsers(userIds, params);
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
