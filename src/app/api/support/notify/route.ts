import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { render } from "@react-email/render";
import { NotificationEmail } from "@/emails/notification";

export const dynamic = "force-dynamic";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://intranet.emporioessenza.com.br").replace(/\/$/, "");

const TIPO_LABELS: Record<string, string> = {
  acesso: "Acesso",
  senha: "Senha",
  outro: "Outro",
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const allowed = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
  if (!token || !allowed.includes(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nome, email, tipo, descricao } = await request.json();
  if (!nome) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const resend = getResend();
  if (!resend) return NextResponse.json({ error: "Resend not configured" }, { status: 500 });

  const admin = createAdminClient();
  const { data: recipients } = await admin
    .from("support_notification_emails")
    .select("email");

  const emails = (recipients || []).map((r) => r.email).filter(Boolean);
  if (emails.length === 0) return NextResponse.json({ sent: 0 });

  const html = await render(
    NotificationEmail({
      title: "Novo ticket de suporte",
      body: [
        `Nome: ${nome}`,
        `Email: ${email}`,
        `Tipo: ${TIPO_LABELS[tipo] || tipo}`,
        "",
        descricao,
      ].join("\n"),
      ctaLabel: "Ver tickets",
      ctaUrl: `${baseUrl}/suporte`,
    }),
  );

  await resend.batch.send(
    emails.map((to) => ({
      from: FROM_EMAIL,
      to,
      subject: `Novo ticket de suporte: ${nome}`,
      html,
    })),
  );

  return NextResponse.json({ sent: emails.length });
}
