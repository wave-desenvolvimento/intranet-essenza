import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OrdersAdmin } from "./orders-admin";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function OrdersAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  // Check permission
  const { data: perms } = await supabase.rpc("get_user_permissions", { _user_id: userId });
  const realPermKeys = (perms || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);

  if (!effectivePerms.includes("pedidos.view_all")) notFound();

  const canApprove = effectivePerms.includes("pedidos.approve");
  const canEdit = effectivePerms.includes("pedidos.edit");
  const canExport = effectivePerms.includes("pedidos.export");
  const canDelete = effectivePerms.includes("pedidos.delete");
  const canManageProducts = effectivePerms.includes("pedidos.manage");

  // Todas as queries em paralelo (sem chamar server actions que recriam o client)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();

  const [ordersRes, statPending, statToday, statWeek, statMonth, ppRes, stRes, productsRes, franchisesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*, franchise:franchises(id, name, segment, status), items:order_items(*)")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", monthAgo),
    supabase.from("payment_plans").select("*").eq("active", true).order("sort_order"),
    supabase.from("shipping_types").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("products")
      .select("*, prices:product_prices(*), product_category:product_categories(id, name)")
      .eq("active", true)
      .order("category")
      .order("name"),
    supabase.from("franchises").select("id, name, status").order("name"),
  ]);

  const orders = ordersRes.data || [];

  // Enrich orders with creator/seller names + payment/shipping names in parallel
  if (orders.length > 0) {
    const userIds = [...new Set([
      ...orders.map((o) => o.created_by),
      ...orders.map((o) => o.seller_id),
    ].filter(Boolean))];
    const ppIds = [...new Set(orders.map((o) => o.payment_plan_id).filter(Boolean))];
    const stIds = [...new Set(orders.map((o) => o.shipping_type_id).filter(Boolean))];

    const [profilesRes, ppNamesRes, stNamesRes] = await Promise.all([
      userIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] },
      ppIds.length > 0 ? supabase.from("payment_plans").select("id, name").in("id", ppIds) : { data: [] },
      stIds.length > 0 ? supabase.from("shipping_types").select("id, name").in("id", stIds) : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p.full_name]));
    const ppMap = new Map((ppNamesRes.data || []).map((p) => [p.id, p]));
    const stMap = new Map((stNamesRes.data || []).map((s) => [s.id, s]));

    for (const order of orders) {
      (order as Record<string, unknown>).creator_name = profileMap.get(order.created_by) || null;
      (order as Record<string, unknown>).seller_name = order.seller_id ? profileMap.get(order.seller_id) || null : null;
      (order as Record<string, unknown>).payment_plan = order.payment_plan_id ? ppMap.get(order.payment_plan_id) || null : null;
      (order as Record<string, unknown>).shipping_type = order.shipping_type_id ? stMap.get(order.shipping_type_id) || null : null;
    }
  }

  return (
    <OrdersAdmin
      orders={orders}
      stats={{
        pending: statPending.count || 0,
        today: statToday.count || 0,
        week: statWeek.count || 0,
        month: statMonth.count || 0,
      }}
      franchises={franchisesRes.data || []}
      permissions={{ canApprove, canEdit, canExport, canDelete, canManageProducts }}
      paymentPlans={ppRes.data || []}
      shippingTypes={stRes.data || []}
      products={productsRes.data || []}
      currentUserId={userId}
    />
  );
}
