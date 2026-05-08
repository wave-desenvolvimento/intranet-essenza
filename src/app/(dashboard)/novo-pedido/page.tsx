import { createClient } from "@/lib/supabase/server";
import { getActiveProducts, getMyOrders } from "./actions";
import { OrderPage } from "./order-page";
import { isSystemAdmin } from "@/lib/permissions";

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise_id, franchise:franchises(name, segment)")
    .eq("id", user?.id || "")
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  const products = await getActiveProducts();
  const orders = await getMyOrders();
  const isAdmin = await isSystemAdmin(user?.id || "");

  return (
    <OrderPage
      products={products}
      orders={orders}
      segment={franchise?.segment || "franquia"}
      franchiseName={franchise?.name || ""}
      franchiseId={profile?.franchise_id || ""}
      isAdmin={isAdmin}
    />
  );
}
