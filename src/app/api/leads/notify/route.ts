import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { render } from "@react-email/render";
import { NotificationEmail } from "@/emails/notification";

export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://intranet.emporioessenza.com.br";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { nome, email, telefone, cidade, estado, origem } = body;

  if (!nome) {
    return NextResponse.json({ error: "Missing lead data" }, { status: 400 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const admin = createAdminClient();

  // Get registered notification emails
  const { data: recipients } = await admin
    .from("lead_notification_emails")
    .select("email");

  const emails = (recipients || []).map((r) => r.email).filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ sent: 0, reason: "No recipients configured" });
  }

  const origemLabel = origem === "primeiro-pedido" ? "Primeiro Pedido" : "Revenda";
  const localizacao = [cidade, estado].filter(Boolean).join(" - ");

  const html = await render(
    NotificationEmail({
      title: "Novo lead de revenda",
      body: [
        `Nome: ${nome}`,
        email ? `Email: ${email}` : null,
        telefone ? `Telefone: ${telefone}` : null,
        localizacao ? `Localização: ${localizacao}` : null,
        `Origem: ${origemLabel}`,
      ].filter(Boolean).join("\n"),
      ctaLabel: "Ver leads",
      ctaUrl: `${baseUrl}/leads`,
    }),
  );

  await resend.batch.send(
    emails.map((to) => ({
      from: FROM_EMAIL,
      to,
      subject: `Novo lead: ${nome}`,
      html,
    })),
  );

  return NextResponse.json({ sent: emails.length });
}
