import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const reportSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  email: z.union([z.literal(""), z.string().email().max(200)]).nullish(),
  message: z.string().trim().min(1).max(5000),
  service: z.string().trim().max(120).nullish(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!rateLimit(`status-report:${ip}`, { limit: 5, windowSec: 300 }).success) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { name, email, message, service } = parsed.data;

  const { error } = await createAdminClient().from("status_reports").insert({
    name: name || null,
    email: email || null,
    message,
    service: service || null,
  });
  if (error) return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
