"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const fullName = formData.get("fullName") as string;
  const avatarUrl = formData.get("avatarUrl") as string;

  if (!fullName) return { error: "Nome é obrigatório." };

  // Validate avatar URL — only allow https:// URLs from trusted sources
  let safeAvatarUrl: string | undefined;
  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { error: "URL de avatar inválida." };
      }
      safeAvatarUrl = avatarUrl;
    } catch {
      return { error: "URL de avatar inválida." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { error: "Erro ao atualizar perfil." };

  // Update user metadata too
  await supabase.auth.updateUser({
    data: { full_name: fullName, avatar_url: safeAvatarUrl },
  });

  revalidatePath("/perfil");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) return { error: "Preencha todos os campos." };
  if (newPassword.length < 6) return { error: "A nova senha deve ter no mínimo 6 caracteres." };
  if (newPassword !== confirmPassword) return { error: "As senhas não conferem." };

  // Verify current password by re-authenticating
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Erro ao verificar usuário." };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) return { error: "Senha atual incorreta." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: "Erro ao alterar senha." };

  return { success: "Senha alterada com sucesso." };
}
