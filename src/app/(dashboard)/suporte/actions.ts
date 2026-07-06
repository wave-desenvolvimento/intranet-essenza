"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export interface SupportTicket {
  id: string;
  nome: string;
  email: string;
  tipo: "acesso" | "senha" | "outro";
  descricao: string;
  status: "novo" | "em_andamento" | "resolvido";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketsResult {
  data: SupportTicket[];
  total: number;
  counts: Record<string, number>;
}

const PAGE_SIZE = 30;

export async function getTickets(params?: {
  status?: string;
  search?: string;
  page?: number;
}): Promise<TicketsResult> {
  await requireAuth();
  const supabase = await createClient();
  const { status, search, page = 0 } = params || {};

  const { data: all } = await supabase
    .from("support_tickets")
    .select("status");
  const counts: Record<string, number> = {};
  for (const t of all || []) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }

  let query = supabase
    .from("support_tickets")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(
      `nome.ilike.%${search}%,email.ilike.%${search}%,descricao.ilike.%${search}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const { data, count } = await query;

  return {
    data: (data || []) as SupportTicket[],
    total: count || 0,
    counts,
  };
}

export async function updateTicketStatus(id: string, status: string) {
  const p = await requirePermission("suporte", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase
    .from("support_tickets")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "update", entityType: "support_ticket", entityId: id, description: `Alterou status do ticket para "${status}"` });
  revalidatePath("/suporte");
  return { success: true };
}

export async function updateTicketNotes(id: string, notas: string) {
  const p = await requirePermission("suporte", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase
    .from("support_tickets")
    .update({ notas })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "update", entityType: "support_ticket", entityId: id, description: "Atualizou notas do ticket" });
  revalidatePath("/suporte");
  return { success: true };
}

export async function deleteTicket(id: string) {
  const p = await requirePermission("suporte", "delete");
  if (p.error) return p;
  const supabase = await createClient();

  const { data: ticket } = await supabase.from("support_tickets").select("nome").eq("id", id).single();
  const { error } = await supabase.from("support_tickets").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "delete", entityType: "support_ticket", entityId: id, description: `Removeu ticket de "${ticket?.nome || id}"` });
  revalidatePath("/suporte");
  return { success: true };
}

// Notification emails

export interface SupportNotificationEmail {
  id: string;
  email: string;
  created_at: string;
}

export async function getSupportNotificationEmails(): Promise<SupportNotificationEmail[]> {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_notification_emails")
    .select("*")
    .order("created_at");
  return (data || []) as SupportNotificationEmail[];
}

export async function addSupportNotificationEmail(email: string) {
  const p = await requirePermission("suporte", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Email invalido." };

  const { error } = await supabase
    .from("support_notification_emails")
    .insert({ email: trimmed });

  if (error) {
    if (error.code === "23505") return { error: "Email ja cadastrado." };
    return { error: error.message };
  }

  revalidatePath("/suporte");
  return { success: true };
}

export async function removeSupportNotificationEmail(id: string) {
  const p = await requirePermission("suporte", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase
    .from("support_notification_emails")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/suporte");
  return { success: true };
}
