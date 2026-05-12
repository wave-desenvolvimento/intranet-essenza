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
    .select("*, questions:survey_questions(id, label, type, options, required, sort_order), responses:survey_responses(id, score, comment, user_id, franchise_id, created_at, answers:survey_answers(question_id, value))")
    .order("created_at", { ascending: false });

  // Sort questions by sort_order
  return (data || []).map((s) => ({
    ...s,
    questions: (s.questions || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  }));
}

interface QuestionInput {
  label: string;
  type: "nps" | "rating" | "text" | "choice";
  options?: string[];
  required: boolean;
}

export async function createSurvey(formData: FormData) {
  const p = await requirePermission("pesquisas", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const endsAt = formData.get("endsAt") as string;
  const questionsJson = formData.get("questions") as string;

  if (!title) return { error: "Título é obrigatório." };

  let questions: QuestionInput[] = [];
  try { questions = JSON.parse(questionsJson || "[]"); } catch { /* empty */ }

  // Default NPS question if none provided
  if (questions.length === 0) {
    questions = [{ label: "De 0 a 10, o quanto você recomendaria a Essenza?", type: "nps", required: true }];
  }

  const { data: survey, error } = await supabase.from("surveys").insert({
    title, description: description || null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    created_by: user?.id,
  }).select("id").single();

  if (error || !survey) return { error: "Erro ao criar pesquisa." };

  // Insert questions
  await supabase.from("survey_questions").insert(
    questions.map((q, i) => ({
      survey_id: survey.id,
      label: q.label,
      type: q.type,
      options: q.type === "choice" && q.options ? q.options : null,
      required: q.required,
      sort_order: i,
    }))
  );

  await logAudit({ action: "create", entityType: "survey", entityId: survey.id, description: `Criou pesquisa "${title}" com ${questions.length} pergunta(s)` });
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

export async function submitResponse(surveyId: string, answers: { questionId: string; value: string }[], comment: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase.from("profiles").select("franchise_id").eq("id", user.id).single();

  // Extract NPS score from answers (first nps-type question)
  const { data: questions } = await supabase.from("survey_questions").select("id, type").eq("survey_id", surveyId);
  const npsQuestion = (questions || []).find((q) => q.type === "nps");
  const npsAnswer = npsQuestion ? answers.find((a) => a.questionId === npsQuestion.id) : null;
  const npsScore = npsAnswer ? parseInt(npsAnswer.value, 10) : null;

  const { data: response, error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    user_id: user.id,
    franchise_id: profile?.franchise_id || null,
    score: npsScore,
    comment: comment || null,
  }).select("id").single();

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) return { error: "Você já respondeu esta pesquisa." };
    return { error: "Erro ao enviar resposta." };
  }

  // Insert individual answers
  if (answers.length > 0 && response) {
    await supabase.from("survey_answers").insert(
      answers.map((a) => ({
        question_id: a.questionId,
        response_id: response.id,
        value: a.value,
      }))
    );
  }

  revalidatePath("/pesquisas");
  return { success: true };
}
