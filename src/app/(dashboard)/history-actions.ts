"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/permissions";

export async function getItemHistory(itemId: string) {
  await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("cms_item_history")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data || [];
}

export async function revertToVersion(itemId: string, historyId: string) {
  const p = await requirePermission("cms", "edit"); if (p.error) return p;
  const supabase = await createClient();

  // Get the history entry
  const { data: version } = await supabase
    .from("cms_item_history")
    .select("data, status")
    .eq("id", historyId)
    .single();

  if (!version) return { error: "Versão não encontrada." };

  // Update the item (this will auto-save current state as new history via trigger)
  const { error } = await supabase
    .from("cms_items")
    .update({ data: version.data, status: version.status })
    .eq("id", itemId);

  if (error) return { error: "Erro ao reverter." };

  revalidatePath("/cms");
  return { success: true };
}
