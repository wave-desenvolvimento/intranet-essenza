import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * This endpoint is called by pg_net after process_health_checks detects a status change.
 * It sends push notifications and emails to admins.
 */
export async function POST(request: Request) {
  // Verify internal call
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { monitor_name, new_status } = await request.json();
  if (!monitor_name || !new_status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const isDown = new_status === "down";
  const title = isDown ? `${monitor_name} está fora do ar` : `${monitor_name} voltou ao normal`;
  const body = isDown
    ? `O serviço ${monitor_name} não está respondendo.`
    : `O serviço ${monitor_name} está operacional novamente.`;

  // 1. Create in-app notification for all admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, user_roles!inner(role:roles!inner(is_system, level))")
    .eq("status", "active");

  const adminIds = (admins || [])
    .filter((a: Record<string, unknown>) => {
      const roles = a.user_roles as { role: { is_system: boolean; level: number } }[];
      return roles?.some((ur) => ur.role?.is_system && ur.role?.level >= 80);
    })
    .map((a: Record<string, unknown>) => a.id as string);

  if (adminIds.length > 0) {
    await supabase.from("notifications").insert(
      adminIds.map((userId: string) => ({
        user_id: userId,
        title,
        body,
        href: "/status",
        icon: isDown ? "alert-triangle" : "check-circle",
      }))
    );

    // 2. Push notifications
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey && privateKey) {
      webpush.setVapidDetails("mailto:tech@emporioessenza.com.br", publicKey, privateKey);

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in("user_id", adminIds);

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({ title, body, href: "/status" });
        await Promise.allSettled(
          subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { TTL: 3600 }
            ).catch(() => {})
          )
        );
      }
    }
  }

  // 3. Email alert
  const resendKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.COMMERCIAL_EMAIL || "tech@emporioessenza.com.br";
  if (resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Essenza Hub <noreply@emporioessenza.com.br>",
      to: emailTo,
      subject: title,
      html: `<p>${body}</p><p><a href="https://intranet-essenza.vercel.app/status">Ver status page</a></p>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, notified: adminIds.length });
}
