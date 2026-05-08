"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const passwordSchema = z.object({
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres."),
  confirmPassword: z.string().min(1, "Confirme a senha."),
});

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const parsed = passwordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (password !== confirmPassword) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { password_set: true },
  });

  if (error) {
    return { error: "Erro ao atualizar senha. O link pode ter expirado." };
  }

  return { success: true };
}
