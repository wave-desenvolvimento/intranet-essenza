import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { render } from "@react-email/render";
import { NotificationEmail } from "@/emails/notification";

// ---- Email categories ----
// "system" always sends (invites, support tickets, password resets)
export type EmailCategory = "content" | "announcements" | "surveys" | "orders" | "system";

// Defaults per category (missing key in user prefs = use this)
const CATEGORY_DEFAULTS: Record<EmailCategory, boolean> = {
  content: false,       // CMS content - off by default (main spam source)
  announcements: true,
  surveys: true,
  orders: true,
  system: true,         // always on, never toggleable
};

interface NotifyParams {
  title: string;
  body?: string;
  href?: string;
  icon?: string;
}

interface EmailParams {
  subject: string;
  emailBody: string;
  ctaLabel?: string;
  /** Absolute path like "/inicio" or full URL */
  ctaUrl?: string;
  /** Category for preference filtering. Defaults to "system" (always sends). */
  category?: EmailCategory;
}

// ---- Core: notify a list of user IDs ----

interface NotifyUsersOptions {
  userIds: string[];
  notification: NotifyParams;
  email?: EmailParams;
}

export async function notifyUsers({ userIds, notification, email }: NotifyUsersOptions) {
  if (userIds.length === 0) return;

  const supabase = createAdminClient();

  // 1. In-app notifications
  const rows = userIds.map((uid) => ({
    user_id: uid,
    title: notification.title,
    body: notification.body || null,
    href: notification.href || null,
    icon: notification.icon || "bell",
  }));
  await supabase.from("notifications").insert(rows);

  // 2. Push (non-blocking)
  sendPushToUsers(userIds, {
    title: notification.title,
    body: notification.body,
    href: notification.href,
  }).catch(() => {});

  // 3. Email (non-blocking, respects user preferences)
  if (email) {
    const category = email.category || "system";
    if (category === "system") {
      // System emails always send
      sendBatchEmail(userIds, email).catch(() => {});
    } else {
      // Filter users by email preference
      filterUsersByEmailPref(userIds, category).then((filteredIds) => {
        if (filteredIds.length > 0) sendBatchEmail(filteredIds, email);
      }).catch(() => {});
    }
  }
}

// ---- Notify by permission ----

interface NotifyByPermissionOptions {
  module: string;
  action: string;
  notification: NotifyParams;
  email?: EmailParams;
  excludeUserId?: string;
}

export async function notifyByPermission({ module, action, notification, email, excludeUserId }: NotifyByPermissionOptions) {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, user_roles!inner(role_id, role:roles!inner(id, permissions!inner(module, action)))")
    .eq("status", "active")
    .eq("user_roles.role.permissions.module", module)
    .eq("user_roles.role.permissions.action", action);

  const userIds = (users || [])
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);

  await notifyUsers({ userIds, notification, email });
}

// ---- Notify all active users ----

interface NotifyAllOptions {
  notification: NotifyParams;
  email?: EmailParams;
  excludeUserId?: string;
}

export async function notifyAllActive({ notification, email, excludeUserId }: NotifyAllOptions) {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .eq("status", "active");

  const userIds = (users || [])
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);

  await notifyUsers({ userIds, notification, email });
}

// ---- Notify franchise ----

interface NotifyFranchiseOptions {
  franchiseId: string;
  notification: NotifyParams;
  email?: EmailParams;
  excludeUserId?: string;
}

export async function notifyFranchise({ franchiseId, notification, email, excludeUserId }: NotifyFranchiseOptions) {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .eq("franchise_id", franchiseId)
    .eq("status", "active");

  const userIds = (users || [])
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);

  await notifyUsers({ userIds, notification, email });
}

// ---- Email preference helpers ----

export function getUserEmailPref(prefs: Record<string, boolean> | null, category: EmailCategory): boolean {
  if (category === "system") return true;
  if (!prefs || !(category in prefs)) return CATEGORY_DEFAULTS[category];
  return !!prefs[category];
}

async function filterUsersByEmailPref(userIds: string[], category: EmailCategory): Promise<string[]> {
  if (category === "system") return userIds;

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email_prefs")
    .in("id", userIds);

  if (!profiles) return [];

  return profiles
    .filter((p) => getUserEmailPref(p.email_prefs as Record<string, boolean> | null, category))
    .map((p) => p.id);
}

// ---- Email dispatch (internal) ----

const BATCH_SIZE = 50;
const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://intranet.emporioessenza.com.br").replace(/\/$/, "");

async function sendBatchEmail(userIds: string[], params: EmailParams) {
  const resend = getResend();
  if (!resend) return;

  // Get emails from auth.users via admin RPC
  const admin = createAdminClient();
  const { data: emailRows } = await admin.rpc("get_user_emails", { user_ids: userIds });

  const emails = (emailRows || [])
    .map((r: { email: string }) => r.email)
    .filter(Boolean);

  if (emails.length === 0) return;

  const ctaUrl = params.ctaUrl
    ? params.ctaUrl.startsWith("http") ? params.ctaUrl : `${baseUrl}${params.ctaUrl}`
    : undefined;

  const prefsUrl = `${baseUrl}/perfil#notificacoes`;

  const html = await render(
    NotificationEmail({
      title: params.subject,
      body: params.emailBody,
      ctaLabel: params.ctaLabel,
      ctaUrl,
      prefsUrl,
    }),
  );

  // Send in batches of 50 (Resend batch limit is 100)
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    await resend.batch.send(
      batch.map((to: string) => ({
        from: FROM_EMAIL,
        to,
        subject: params.subject,
        html,
      })),
    );
  }
}
