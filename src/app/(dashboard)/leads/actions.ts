"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export interface ResellerLead {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  tipo_cadastro: "revendedor" | "multimarcas" | null;
  origem: "revenda" | "primeiro-pedido";
  status: "novo" | "em_contato" | "convertido" | "descartado";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadsResult {
  data: ResellerLead[];
  total: number;
  counts: Record<string, number>;
}

const PAGE_SIZE = 30;

export async function getLeads(params?: {
  status?: string;
  origem?: string;
  search?: string;
  page?: number;
}): Promise<LeadsResult> {
  await requireAuth();
  const supabase = await createClient();
  const { status, origem, search, page = 0 } = params || {};

  // Counts per status (always unfiltered for the cards)
  const { data: allLeads } = await supabase
    .from("reseller_leads")
    .select("status");
  const counts: Record<string, number> = {};
  for (const l of allLeads || []) {
    counts[l.status] = (counts[l.status] || 0) + 1;
  }

  // Filtered query
  let query = supabase
    .from("reseller_leads")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (origem) query = query.eq("origem", origem);
  if (search) {
    query = query.or(
      `nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,cnpj.ilike.%${search}%,cidade.ilike.%${search}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const { data, count } = await query;

  return {
    data: (data || []) as ResellerLead[],
    total: count || 0,
    counts,
  };
}

export async function getLeadsForExport(params?: {
  status?: string;
  origem?: string;
  search?: string;
}): Promise<ResellerLead[]> {
  const p = await requirePermission("leads", "export");
  if (p.error) return [];
  const supabase = await createClient();
  const { status, origem, search } = params || {};

  let query = supabase
    .from("reseller_leads")
    .select("*");

  if (status) query = query.eq("status", status);
  if (origem) query = query.eq("origem", origem);
  if (search) {
    query = query.or(
      `nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,cnpj.ilike.%${search}%,cidade.ilike.%${search}%`
    );
  }

  const { data } = await query.order("created_at", { ascending: false });
  return (data || []) as ResellerLead[];
}

export async function updateLeadStatus(id: string, status: string) {
  const p = await requirePermission("leads", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase
    .from("reseller_leads")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "update", entityType: "leads", entityId: id, description: `Alterou status do lead para "${status}"` });
  revalidatePath("/leads");
  return { success: true };
}

export async function updateLeadNotes(id: string, notas: string) {
  const p = await requirePermission("leads", "edit");
  if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase
    .from("reseller_leads")
    .update({ notas })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "update", entityType: "leads", entityId: id, description: "Atualizou notas do lead" });
  revalidatePath("/leads");
  return { success: true };
}

export async function deleteLead(id: string) {
  const p = await requirePermission("leads", "delete");
  if (p.error) return p;
  const supabase = await createClient();

  const { data: lead } = await supabase.from("reseller_leads").select("nome").eq("id", id).single();
  const { error } = await supabase.from("reseller_leads").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "delete", entityType: "leads", entityId: id, description: `Removeu lead "${lead?.nome || id}"` });
  revalidatePath("/leads");
  return { success: true };
}
