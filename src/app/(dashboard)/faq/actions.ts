"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function getFaqCategories() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase.from("faq_categories").select("*").order("sort_order");
  return data || [];
}

export async function getFaqItems() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_items")
    .select("*, category:faq_categories(id, name, slug, icon)")
    .order("sort_order");
  return data || [];
}

export async function createFaqCategory(name: string, icon: string) {
  const p = await requirePermission("faq", "create"); if (p.error) return p;
  const supabase = await createClient();
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const { error } = await supabase.from("faq_categories").insert({ name, slug, icon });
  if (error) return { error: error.message };
  revalidatePath("/faq");
  return { success: true };
}

export async function deleteFaqCategory(id: string) {
  const p = await requirePermission("faq", "delete"); if (p.error) return p;
  const supabase = await createClient();
  await supabase.from("faq_items").update({ category_id: null }).eq("category_id", id);
  const { error } = await supabase.from("faq_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/faq");
  return { success: true };
}

export async function createFaqItem(formData: FormData) {
  const p = await requirePermission("faq", "create"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const question = formData.get("question") as string;
  const answer = formData.get("answer") as string;
  const categoryId = formData.get("categoryId") as string;

  if (!question || !answer) return { error: "Pergunta e resposta são obrigatórios." };

  const { error } = await supabase.from("faq_items").insert({
    question, answer,
    category_id: categoryId || null,
    created_by: user?.id,
  });
  if (error) return { error: "Erro ao criar pergunta." };

  await logAudit({ action: "create", entityType: "faq", description: `Criou FAQ "${question.slice(0, 60)}"` });
  revalidatePath("/faq");
  return { success: true };
}

export async function updateFaqItem(formData: FormData) {
  const p = await requirePermission("faq", "edit"); if (p.error) return p;
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const question = formData.get("question") as string;
  const answer = formData.get("answer") as string;
  const categoryId = formData.get("categoryId") as string;
  const published = formData.get("published") !== "false";

  if (!id || !question || !answer) return { error: "Dados inválidos." };

  const { error } = await supabase.from("faq_items").update({
    question, answer,
    category_id: categoryId || null,
    published,
  }).eq("id", id);
  if (error) return { error: "Erro ao editar pergunta." };

  await logAudit({ action: "update", entityType: "faq", entityId: id, description: `Editou FAQ "${question.slice(0, 60)}"` });
  revalidatePath("/faq");
  return { success: true };
}

export async function deleteFaqItem(id: string) {
  const p = await requirePermission("faq", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { data: item } = await supabase.from("faq_items").select("question").eq("id", id).single();
  const { error } = await supabase.from("faq_items").delete().eq("id", id);
  if (error) return { error: "Erro ao remover." };

  await logAudit({ action: "delete", entityType: "faq", entityId: id, description: `Removeu FAQ "${item?.question?.slice(0, 60) || id}"` });
  revalidatePath("/faq");
  return { success: true };
}
