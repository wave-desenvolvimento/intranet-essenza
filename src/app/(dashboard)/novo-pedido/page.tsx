import { createClient } from "@/lib/supabase/server";
import { OrderPage } from "./order-page";

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  // Todas as queries em paralelo
  const [profileRes, productsRes, canManageRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("franchise_id, franchise:franchises(name, segment)")
      .eq("id", userId)
      .single(),
    supabase
      .from("products")
      .select("*, prices:product_prices(*), product_category:product_categories(id, name)")
      .eq("active", true)
      .order("category")
      .order("name"),
    supabase.rpc("has_permission", { _user_id: userId, _module: "pedidos", _action: "manage" }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profileRes.data?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;
  const franchiseId = profileRes.data?.franchise_id || "";

  // Orders da franquia - depende do franchise_id
  const { data: orders } = franchiseId
    ? await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("franchise_id", franchiseId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <OrderPage
      products={productsRes.data || []}
      orders={orders || []}
      segment={franchise?.segment || "franquia"}
      franchiseName={franchise?.name || ""}
      franchiseId={franchiseId}
      isAdmin={!!canManageRes.data}
    />
  );
}
