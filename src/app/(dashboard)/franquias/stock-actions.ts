"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function getFranchiseStock(franchiseId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("franchise_stock")
    .select("*, product:products(id, name, sku, category)")
    .eq("franchise_id", franchiseId)
    .order("product(name)");
  return data || [];
}

export async function updateStock(franchiseId: string, productId: string, quantity: number, minQuantity: number) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("franchise_stock").upsert({
    franchise_id: franchiseId,
    product_id: productId,
    quantity,
    min_quantity: minQuantity,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "franchise_id,product_id" });

  if (error) return { error: "Erro ao atualizar estoque." };

  const { data: product } = await supabase.from("products").select("name").eq("id", productId).single();
  await logAudit({
    action: "update",
    entityType: "stock",
    entityId: `${franchiseId}:${productId}`,
    description: `Atualizou estoque de "${product?.name || productId}": ${quantity} un (mín: ${minQuantity})`,
  });

  revalidatePath(`/franquias`);
  return { success: true };
}

export async function initializeStock(franchiseId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get all active products
  const { data: products } = await supabase.from("products").select("id").eq("active", true);
  if (!products || products.length === 0) return { error: "Nenhum produto ativo." };

  // Get existing stock entries
  const { data: existing } = await supabase
    .from("franchise_stock")
    .select("product_id")
    .eq("franchise_id", franchiseId);
  const existingIds = new Set((existing || []).map((s) => s.product_id));

  // Insert missing products with 0 stock
  const missing = products.filter((p) => !existingIds.has(p.id));
  if (missing.length === 0) return { success: true, added: 0 };

  const { error } = await supabase.from("franchise_stock").insert(
    missing.map((p) => ({
      franchise_id: franchiseId,
      product_id: p.id,
      quantity: 0,
      min_quantity: 0,
      updated_by: user?.id,
    }))
  );

  if (error) return { error: "Erro ao inicializar estoque." };

  revalidatePath(`/franquias`);
  return { success: true, added: missing.length };
}
