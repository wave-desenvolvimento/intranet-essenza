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

export async function getLeads() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reseller_leads")
    .select("*")
    .order("created_at", { ascending: false });
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
