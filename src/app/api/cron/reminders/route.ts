import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { render } from "@react-email/render";
import { NotificationEmail } from "@/emails/notification";

export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://intranet.emporioessenza.com.br";
const REMINDER_AFTER_DAYS = 3;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let surveyReminders = 0;
  let announcementReminders = 0;

  // 1. Surveys: active, created before cutoff, user hasn't responded
  const { data: activeSurveys } = await admin
    .from("surveys")
    .select("id, title, description")
    .eq("active", true)
    .lte("created_at", cutoff);

  for (const survey of activeSurveys || []) {
    // Get users who haven't responded
    const { data: responded } = await admin
      .from("survey_responses")
      .select("user_id")
      .eq("survey_id", survey.id);

    const respondedIds = new Set((responded || []).map((r) => r.user_id));

    const { data: allUsers } = await admin
      .from("profiles")
      .select("id")
      .eq("status", "active");

    const pendingIds = (allUsers || [])
      .map((u) => u.id)
      .filter((id) => !respondedIds.has(id));

    if (pendingIds.length === 0) continue;

    // Check who already got a reminder for this survey (avoid spamming)
    const { data: alreadyReminded } = await admin
      .from("notifications")
      .select("user_id")
      .like("title", `Lembrete: ${survey.title}%`)
      .in("user_id", pendingIds);

    const remindedIds = new Set((alreadyReminded || []).map((n) => n.user_id));
    const toRemind = pendingIds.filter((id) => !remindedIds.has(id));

    if (toRemind.length === 0) continue;

    // Create in-app notifications
    await admin.from("notifications").insert(
      toRemind.map((uid) => ({
        user_id: uid,
        title: `Lembrete: ${survey.title}`,
        body: "Sua resposta ainda está pendente.",
        href: "/inicio",
        icon: "clipboard-list",
      })),
    );

    // Send emails
    const emails = await getUserEmails(admin, toRemind);
    if (emails.length > 0) {
      const html = await render(
        NotificationEmail({
          title: `Lembrete — ${survey.title}`,
          body: `A pesquisa "${survey.title}" ainda aguarda sua resposta.${survey.description ? `\n\n${survey.description}` : ""}\n\nSua opinião é muito importante para a melhoria contínua da rede.`,
          ctaLabel: "Responder agora",
          ctaUrl: `${baseUrl}/inicio`,
          footnote: "Este é um lembrete automático.",
        }),
      );

      for (let i = 0; i < emails.length; i += 50) {
        await resend.batch.send(
          emails.slice(i, i + 50).map((to) => ({
            from: FROM_EMAIL,
            to,
            subject: `Lembrete: pesquisa "${survey.title}" aguarda sua resposta`,
            html,
          })),
        );
      }
    }

    surveyReminders += toRemind.length;
  }

  // 2. Announcements: created before cutoff, user hasn't read
  const { data: recentAnnouncements } = await admin
    .from("announcements")
    .select("id, title, body")
    .lte("created_at", cutoff)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  for (const ann of recentAnnouncements || []) {
    const { data: reads } = await admin
      .from("announcement_reads")
      .select("user_id")
      .eq("announcement_id", ann.id);

    const readIds = new Set((reads || []).map((r) => r.user_id));

    const { data: allUsers } = await admin
      .from("profiles")
      .select("id")
      .eq("status", "active");

    const pendingIds = (allUsers || [])
      .map((u) => u.id)
      .filter((id) => !readIds.has(id));

    if (pendingIds.length === 0) continue;

    // Check who already got a reminder for this announcement
    const { data: alreadyReminded } = await admin
      .from("notifications")
      .select("user_id")
      .like("title", `Lembrete: ${ann.title}%`)
      .in("user_id", pendingIds);

    const remindedIds = new Set((alreadyReminded || []).map((n) => n.user_id));
    const toRemind = pendingIds.filter((id) => !remindedIds.has(id));

    if (toRemind.length === 0) continue;

    await admin.from("notifications").insert(
      toRemind.map((uid) => ({
        user_id: uid,
        title: `Lembrete: ${ann.title}`,
        body: "Comunicado ainda não lido.",
        href: "/comunicados",
        icon: "megaphone",
      })),
    );

    const emails = await getUserEmails(admin, toRemind);
    if (emails.length > 0) {
      const plainBody = ann.body.replace(/<[^>]+>/g, "").slice(0, 300);
      const html = await render(
        NotificationEmail({
          title: `Lembrete — ${ann.title}`,
          body: `O comunicado "${ann.title}" ainda não foi lido.\n\n${plainBody}`,
          ctaLabel: "Ler comunicado",
          ctaUrl: `${baseUrl}/comunicados`,
          footnote: "Este é um lembrete automático.",
        }),
      );

      for (let i = 0; i < emails.length; i += 50) {
        await resend.batch.send(
          emails.slice(i, i + 50).map((to) => ({
            from: FROM_EMAIL,
            to,
            subject: `Lembrete: comunicado "${ann.title}" não lido`,
            html,
          })),
        );
      }
    }

    announcementReminders += toRemind.length;
  }

  return NextResponse.json({
    surveyReminders,
    announcementReminders,
    ranAt: new Date().toISOString(),
  });
}

// Helper: get emails from auth.users via the admin RPC
async function getUserEmails(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<string[]> {
  const { data } = await admin.rpc("get_user_emails", { user_ids: userIds });
  return (data || []).map((r: { email: string }) => r.email).filter(Boolean);
}
