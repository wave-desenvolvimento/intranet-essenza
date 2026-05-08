"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

export async function getMonitors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monitors")
    .select("*")
    .order("sort_order");
  return data || [];
}

export async function createMonitor(formData: FormData) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const url = formData.get("url") as string;
  const method = (formData.get("method") as string) || "GET";
  const headersRaw = formData.get("headers") as string;
  const expectedStatus = parseInt(formData.get("expectedStatus") as string) || 200;
  const intervalMinutes = parseInt(formData.get("intervalMinutes") as string) || 5;

  if (!name || !url) return { error: "Nome e URL são obrigatórios." };

  let headers = {};
  if (headersRaw) {
    try { headers = JSON.parse(headersRaw); } catch { return { error: "Headers deve ser um JSON válido." }; }
  }

  const { error } = await supabase.from("monitors").insert({
    name,
    url,
    method,
    headers,
    expected_status: expectedStatus,
    interval_minutes: intervalMinutes,
  });

  if (error) return { error: error.message };
  revalidatePath("/configuracoes/monitors");
  return { success: true };
}

export async function updateMonitor(formData: FormData) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const url = formData.get("url") as string;
  const method = (formData.get("method") as string) || "GET";
  const headersRaw = formData.get("headers") as string;
  const expectedStatus = parseInt(formData.get("expectedStatus") as string) || 200;
  const intervalMinutes = parseInt(formData.get("intervalMinutes") as string) || 5;
  const isActive = formData.get("isActive") === "true";

  if (!id || !name || !url) return { error: "Campos obrigatórios faltando." };

  let headers = {};
  if (headersRaw) {
    try { headers = JSON.parse(headersRaw); } catch { return { error: "Headers deve ser um JSON válido." }; }
  }

  const { error } = await supabase.from("monitors").update({
    name,
    url,
    method,
    headers,
    expected_status: expectedStatus,
    interval_minutes: intervalMinutes,
    is_active: isActive,
  }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/configuracoes/monitors");
  return { success: true };
}

export async function deleteMonitor(id: string) {
  const p = await requirePermission("configuracoes", "edit"); if (p.error) return p;
  const supabase = await createClient();

  const { error } = await supabase.from("monitors").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes/monitors");
  return { success: true };
}
