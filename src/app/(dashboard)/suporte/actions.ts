"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { render } from "@react-email/render";
import { NotificationEmail } from "@/emails/notification";

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

const REPLY_TEMPLATES: Record<string, { subject: string; title: string; body: string }> = {
  em_andamento: {
    subject: "Seu ticket esta sendo analisado",
    title: "Estamos analisando seu ticket",
    body: "Recebemos sua solicitacao e nossa equipe ja esta trabalhando nela.\n\nEntraremos em contato assim que tivermos uma resolucao. Se precisar de algo urgente, responda este email.",
  },
  resolvido: {
    subject: "Seu ticket foi resolvido",
    title: "Seu ticket foi resolvido",
    body: "Sua solicitacao foi resolvida pela nossa equipe.\n\nCaso o problema persista ou precise de mais ajuda, responda este email ou abra um novo ticket.",
  },
};

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://intranet.emporioessenza.com.br").replace(/\/$/, "");

export async function replyToTicket(id: string, newStatus: "em_andamento" | "resolvido") {
  const p = await requirePermission("suporte", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("nome, email, tipo, descricao, status")
    .eq("id", id)
    .single();

  if (!ticket) return { error: "Ticket nao encontrado." };
  if (ticket.status === newStatus) return { error: "Ticket ja esta nesse status." };

  const template = REPLY_TEMPLATES[newStatus];
  if (!template) return { error: "Status invalido." };

  // Update status
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: newStatus })
    .eq("id", id);
  if (error) return { error: error.message };

  // Send email
  const resend = getResend();
  if (resend) {
    const html = await render(
      NotificationEmail({
        title: template.title,
        body: `Ola, ${ticket.nome}!\n\n${template.body}`,
        ctaLabel: "Acessar o Hub",
        ctaUrl: `${baseUrl}/login`,
      }),
    );

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ticket.email,
      subject: template.subject,
      html,
    });
  }

  await logAudit({
    action: "update",
    entityType: "support_ticket",
    entityId: id,
    description: `Respondeu ticket e alterou status para "${newStatus}"`,
  });

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
