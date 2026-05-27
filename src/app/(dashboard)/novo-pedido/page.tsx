import { createClient } from "@/lib/supabase/server";
import { getActiveProducts, getMyOrders } from "./actions";
import { OrderPage } from "./order-page";

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise_id, franchise:franchises(name, segment)")
    .eq("id", userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  const [products, orders] = await Promise.all([getActiveProducts(), getMyOrders()]);
  const { data: canManageOrders } = await supabase.rpc("has_permission", { _user_id: userId, _module: "pedidos", _action: "manage" });

  return (
    <OrderPage
      products={products}
      orders={orders}
      segment={franchise?.segment || "franquia"}
      franchiseName={franchise?.name || ""}
      franchiseId={profile?.franchise_id || ""}
      isAdmin={!!canManageOrders}
    />
  );
}
