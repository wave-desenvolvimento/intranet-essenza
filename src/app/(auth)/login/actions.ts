"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod/v4";

const loginSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Senha é obrigatória."),
});

const resetSchema = z.object({
  email: z.email("E-mail inválido."),
});

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Rate limit: 5 attempts per minute per email
  const rl = rateLimit(`login:${email.toLowerCase()}`, { limit: 5, windowSec: 60 });
  if (!rl.success) return { error: "Muitas tentativas. Aguarde 1 minuto." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  redirect("/inicio");
}

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;

  const parsed = resetSchema.safeParse({ email });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Rate limit: 3 reset emails per 5 minutes per email
  const rl = rateLimit(`reset:${email.toLowerCase()}`, { limit: 3, windowSec: 300 });
  if (!rl.success) return { error: "Muitas tentativas. Aguarde alguns minutos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").origin : "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: "Erro ao enviar e-mail de recuperação." };
  }

  return { success: "E-mail de recuperação enviado. Verifique sua caixa de entrada." };
}

export async function loginWithSSO() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithSSO({
    domain: "emporioessenza.com.br",
  });

  if (error) {
    return { error: "Erro ao iniciar login SSO." };
  }

  if (data?.url) {
    redirect(data.url);
  }
}
