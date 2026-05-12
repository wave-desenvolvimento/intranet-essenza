"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function getSurveys() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("surveys")
    .select("*, responses:survey_responses(id, score, comment, user_id, franchise_id, created_at)")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function createSurvey(formData: FormData) {
  const p = await requirePermission("pesquisas", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const endsAt = formData.get("endsAt") as string;

  if (!title) return { error: "Título é obrigatório." };

  const { error } = await supabase.from("surveys").insert({
    title, description: description || null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    created_by: user?.id,
  });
  if (error) return { error: "Erro ao criar pesquisa." };

  await logAudit({ action: "create", entityType: "survey", description: `Criou pesquisa "${title}"` });
  revalidatePath("/pesquisas");
  return { success: true };
}

export async function toggleSurvey(id: string, active: boolean) {
  const p = await requirePermission("pesquisas", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("surveys").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/pesquisas");
  return { success: true };
}

export async function deleteSurvey(id: string) {
  const p = await requirePermission("pesquisas", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { data: s } = await supabase.from("surveys").select("title").eq("id", id).single();
  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) return { error: "Erro ao remover pesquisa." };

  await logAudit({ action: "delete", entityType: "survey", entityId: id, description: `Removeu pesquisa "${s?.title || id}"` });
  revalidatePath("/pesquisas");
  return { success: true };
}

export async function submitResponse(surveyId: string, score: number, comment: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase.from("profiles").select("franchise_id").eq("id", user.id).single();

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    user_id: user.id,
    franchise_id: profile?.franchise_id || null,
    score,
    comment: comment || null,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) return { error: "Você já respondeu esta pesquisa." };
    return { error: "Erro ao enviar resposta." };
  }

  revalidatePath("/pesquisas");
  return { success: true };
}
