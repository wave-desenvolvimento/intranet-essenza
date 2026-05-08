"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { OrderNotificationEmail } from "@/emails/order-notification";
import { notifyByPermission, notifyFranchise } from "@/app/(dashboard)/notifications-actions";
import { requirePermission } from "@/lib/permissions";

// === Products ===

export async function getProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, prices:product_prices(*), product_category:product_categories(id, name)")
    .order("sort_order");
  return data || [];
}

export async function getActiveProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, prices:product_prices(*), product_category:product_categories(id, name)")
    .eq("active", true)
    .order("category")
    .order("name");
  return data || [];
}

export async function createProduct(formData: FormData) {
  const p = await requirePermission("products", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const sku = formData.get("sku") as string;
  const category = formData.get("category") as string;
  const unit = formData.get("unit") as string || "un";
  const minQty = Number(formData.get("minQty")) || 1;
  const priceFranquia = formData.get("priceFranquia") as string;
  const pricePdv = formData.get("pricePdv") as string;

  if (!name) return { error: "Nome é obrigatório." };

  const imageUrl = formData.get("imageUrl") as string;
  const stockStatus = formData.get("stockStatus") as string || "in_stock";
  const preOrderDate = formData.get("preOrderDate") as string;

  const { data: product, error } = await supabase
    .from("products")
    .insert({ name, sku: sku || null, category: category || null, category_id: (formData.get("categoryId") as string) || null, unit, min_qty: minQty, image_url: imageUrl || null, stock_status: stockStatus, pre_order_date: preOrderDate || null })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique")) return { error: "SKU já existe." };
    return { error: error.message };
  }

  // Insert prices
  const prices = [];
  if (priceFranquia) prices.push({ product_id: product.id, segment: "franquia", price: Number(priceFranquia) });
  if (pricePdv) prices.push({ product_id: product.id, segment: "multimarca_pdv", price: Number(pricePdv) });
  if (prices.length > 0) await supabase.from("product_prices").insert(prices);

  revalidatePath("/novo-pedido");
  return { success: true };
}

export async function updateProduct(formData: FormData) {
  const p = await requirePermission("products", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const sku = formData.get("sku") as string;
  const category = formData.get("category") as string;
  const unit = formData.get("unit") as string || "un";
  const minQty = Number(formData.get("minQty")) || 1;
  const active = formData.get("active") !== "false";
  const priceFranquia = formData.get("priceFranquia") as string;
  const pricePdv = formData.get("pricePdv") as string;

  if (!id || !name) return { error: "Dados inválidos." };

  const imageUrl = formData.get("imageUrl") as string;
  const stockStatus = formData.get("stockStatus") as string || "in_stock";
  const preOrderDate = formData.get("preOrderDate") as string;

  const { error } = await supabase
    .from("products")
    .update({ name, sku: sku || null, category: category || null, category_id: (formData.get("categoryId") as string) || null, unit, min_qty: minQty, active, image_url: imageUrl || null, stock_status: stockStatus, pre_order_date: preOrderDate || null })
    .eq("id", id);

  if (error) return { error: error.message };

  // Upsert prices
  await supabase.from("product_prices").delete().eq("product_id", id);
  const prices = [];
  if (priceFranquia) prices.push({ product_id: id, segment: "franquia", price: Number(priceFranquia) });
  if (pricePdv) prices.push({ product_id: id, segment: "multimarca_pdv", price: Number(pricePdv) });
  if (prices.length > 0) await supabase.from("product_prices").insert(prices);

  revalidatePath("/novo-pedido");
  return { success: true };
}

export async function deleteProduct(id: string) {
  const p = await requirePermission("products", "delete"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: "Erro ao remover. Pode estar vinculado a pedidos." };
  revalidatePath("/novo-pedido");
  return { success: true };
}

// === Orders ===

export async function getOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, franchise:franchises(name, segment), items:order_items(*), creator:profiles!orders_created_by_fkey(full_name)")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getMyOrders() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("franchise_id").eq("id", user.id).single();
  if (!profile?.franchise_id) return [];

  const { data } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("franchise_id", profile.franchise_id)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase.from("profiles").select("franchise_id").eq("id", user.id).single();
  if (!profile?.franchise_id) return { error: "Sem franquia vinculada." };

  const itemsRaw = formData.get("items") as string;
  const notes = formData.get("notes") as string;

  let items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  try { items = JSON.parse(itemsRaw); } catch { return { error: "Dados inválidos." }; }
  if (!Array.isArray(items) || items.length === 0) return { error: "Adicione ao menos um item." };
  if (items.length > 200) return { error: "Limite de 200 itens por pedido." };

  // Validate prices server-side — fetch real prices from DB
  const { data: franchiseSegment } = await supabase.from("franchises").select("segment").eq("id", profile.franchise_id).single();
  const segment = franchiseSegment?.segment || "franquia";
  const productIds = items.map((i) => i.productId);
  const { data: dbPrices } = await supabase
    .from("product_prices")
    .select("product_id, price")
    .in("product_id", productIds)
    .eq("segment", segment);

  const priceMap = new Map((dbPrices || []).map((p) => [p.product_id, p.price]));

  // Override client prices with server prices
  const validatedItems = items.map((i) => {
    const serverPrice = priceMap.get(i.productId);
    if (serverPrice === undefined) return null;
    return { ...i, unitPrice: serverPrice };
  }).filter(Boolean) as typeof items;

  if (validatedItems.length === 0) return { error: "Nenhum produto válido encontrado." };
  if (validatedItems.length !== items.length) return { error: "Alguns produtos não estão disponíveis para seu segmento." };

  const total = validatedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      franchise_id: profile.franchise_id,
      created_by: user.id,
      status: "enviado",
      notes: notes || null,
      total,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("order_items").insert(
    validatedItems.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: i.quantity * i.unitPrice,
    }))
  );

  // Get franchise + creator names for notifications
  const { data: franchise } = await supabase.from("franchises").select("name").eq("id", profile.franchise_id).single();
  const { data: creator } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  // Send email to commercial team
  const resendClient = getResend();
  if (resendClient) {
    const commercialEmail = process.env.COMMERCIAL_EMAIL || "comercial@emporioessenza.com.br";

    resendClient.emails.send({
      from: FROM_EMAIL,
      to: commercialEmail,
      subject: `Novo pedido — ${franchise?.name || "Franquia"} — R$ ${total.toFixed(2)}`,
      react: OrderNotificationEmail({
        franchiseName: franchise?.name || "",
        orderId: order.id,
        items: validatedItems.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.quantity * i.unitPrice })),
        total,
        notes: notes || undefined,
        createdAt: order.created_at,
        createdBy: creator?.full_name || "",
      }),
    }).catch(() => {});
  }

  // Notify admins with orders permission
  notifyByPermission("orders", "approve", {
    title: `Novo pedido — ${franchise?.name || "Franquia"}`,
    body: `${validatedItems.length} itens · R$ ${total.toFixed(2)}`,
    href: "/gestao-de-pedidos",
    icon: "cart",
  }, user.id).catch(() => {});

  revalidatePath("/novo-pedido");
  return { success: true, orderId: order.id };
}

const STATUS_LABELS: Record<string, string> = {
  enviado: "Enviado", aprovado: "Aprovado", separacao: "Em Separação",
  faturado: "Faturado", cancelado: "Cancelado",
};

export async function updateOrderStatus(orderId: string, status: string) {
  const p = await requirePermission("orders", "approve"); if (p.error) return p;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updates: Record<string, unknown> = { status };
  if (status === "aprovado") {
    updates.approved_by = user?.id;
    updates.approved_at = new Date().toISOString();
  }

  const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
  if (error) return { error: error.message };

  // Notify the franchise that placed the order
  const { data: order } = await supabase.from("orders").select("franchise_id, id").eq("id", orderId).single();
  if (order?.franchise_id) {
    notifyFranchise(order.franchise_id, {
      title: `Pedido #${orderId.slice(0, 8)} — ${STATUS_LABELS[status] || status}`,
      body: `Status do seu pedido foi atualizado`,
      href: "/novo-pedido",
      icon: "cart",
    }, user?.id).catch(() => {});
  }

  revalidatePath("/novo-pedido");
  return { success: true };
}

export async function updateOrderItem(itemId: string, quantity: number) {
  const p = await requirePermission("orders", "approve"); if (p.error) return p;
  const supabase = await createClient();

  const { data: item } = await supabase.from("order_items").select("order_id, unit_price").eq("id", itemId).single();
  if (!item) return { error: "Item não encontrado." };

  if (quantity <= 0) {
    await supabase.from("order_items").delete().eq("id", itemId);
  } else {
    await supabase.from("order_items").update({ quantity, subtotal: quantity * item.unit_price }).eq("id", itemId);
  }

  // Recalculate order total
  const { data: items } = await supabase.from("order_items").select("subtotal").eq("order_id", item.order_id);
  const total = (items || []).reduce((sum, i) => sum + Number(i.subtotal), 0);
  await supabase.from("orders").update({ total }).eq("id", item.order_id);

  revalidatePath("/novo-pedido");
  return { success: true };
}

export async function updateOrderNotes(orderId: string, adminNotes: string) {
  const p = await requirePermission("orders", "approve"); if (p.error) return p;
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ admin_notes: adminNotes }).eq("id", orderId);
  if (error) return { error: error.message };
  revalidatePath("/novo-pedido");
  return { success: true };
}

export async function getAllOrders(filters?: { status?: string; franchiseId?: string; dateFrom?: string; dateTo?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, franchise:franchises(id, name, segment, status), items:order_items(*)")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.franchiseId) query = query.eq("franchise_id", filters.franchiseId);
  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data, error } = await query;
  if (error) { console.error("getAllOrders error:", error.message); return []; }

  // Enrich with creator names
  const orders = data || [];
  if (orders.length > 0) {
    const creatorIds = [...new Set(orders.map((o) => o.created_by).filter(Boolean))];
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
      for (const order of orders) {
        (order as Record<string, unknown>).creator_name = profileMap.get(order.created_by) || null;
      }
    }
  }

  return orders;
}

export async function getOrderStats() {
  const supabase = await createClient();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();

  const [
    { count: totalPending },
    { count: totalToday },
    { count: totalWeek },
    { count: totalMonth },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["enviado", "aprovado"]),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", monthAgo),
  ]);

  return {
    pending: totalPending || 0,
    today: totalToday || 0,
    week: totalWeek || 0,
    month: totalMonth || 0,
  };
}

// === Product Categories ===

export async function getProductCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order");
  return data || [];
}

export async function createProductCategory(name: string) {
  const p = await requirePermission("products", "edit"); if (p.error) return p;
  const supabase = await createClient();
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const { count } = await supabase.from("product_categories").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("product_categories").insert({ name, slug, sort_order: count || 0 });
  if (error) return { error: error.message };
  revalidatePath("/produtos");
  return { success: true };
}

export async function importProducts(rows: { name: string; sku: string; category: string; unit: string; minQty: number; priceFranquia: number; pricePdv: number; stockStatus: string }[]) {
  const p = await requirePermission("products", "edit"); if (p.error) return p;
  const supabase = await createClient();

  if (rows.length === 0) return { error: "Nenhum produto para importar." };
  if (rows.length > 500) return { error: "Limite de 500 produtos por importação." };

  const hasInvalidPrice = rows.some((r) => {
    const prices = [r.priceFranquia, r.pricePdv].filter(Boolean).map(Number);
    return prices.some((price) => isNaN(price) || price <= 0);
  });
  if (hasInvalidPrice) return { error: "Preços devem ser valores positivos." };

  // Resolve categories — create missing ones
  const uniqueCats = [...new Set(rows.map((r) => r.category).filter(Boolean))];
  const { data: existingCats } = await supabase.from("product_categories").select("id, name");
  const catMap = new Map((existingCats || []).map((c) => [c.name.toLowerCase(), c.id]));

  for (const catName of uniqueCats) {
    if (!catMap.has(catName.toLowerCase())) {
      const slug = catName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
      const { data: newCat } = await supabase.from("product_categories").insert({ name: catName, slug, sort_order: (existingCats?.length || 0) + catMap.size }).select("id").single();
      if (newCat) catMap.set(catName.toLowerCase(), newCat.id);
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.name) { skipped++; continue; }

    const categoryId = row.category ? catMap.get(row.category.toLowerCase()) || null : null;

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        name: row.name,
        sku: row.sku || null,
        category: row.category || null,
        category_id: categoryId,
        unit: row.unit || "un",
        min_qty: row.minQty || 1,
        stock_status: row.stockStatus || "in_stock",
        image_url: null,
        pre_order_date: null,
      })
      .select("id")
      .single();

    if (error) {
      skipped++;
      continue;
    }

    const prices = [];
    if (row.priceFranquia > 0) prices.push({ product_id: product.id, segment: "franquia", price: row.priceFranquia });
    if (row.pricePdv > 0) prices.push({ product_id: product.id, segment: "multimarca_pdv", price: row.pricePdv });
    if (prices.length > 0) await supabase.from("product_prices").insert(prices);

    imported++;
  }

  revalidatePath("/produtos");
  revalidatePath("/novo-pedido");
  return { success: true, imported, skipped };
}

export async function deleteProductCategory(id: string) {
  const p = await requirePermission("products", "edit"); if (p.error) return p;
  const supabase = await createClient();
  await supabase.from("products").update({ category_id: null }).eq("category_id", id);
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/produtos");
  return { success: true };
}
