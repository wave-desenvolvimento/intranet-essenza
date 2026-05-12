import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./dashboard-content";
import { getFavorites } from "../favorites-actions";
import { getEffectivePermissions } from "@/lib/dev-mode-server"; // kept for dev mode switcher

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile with full franchise data
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, franchise_id, franchise:franchises(*)")
    .eq("id", user.id)
    .single();

  // Fetch real stats
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { count: totalFranchises } = await supabase
    .from("franchises")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // Fetch user permissions
  const { data: permissions } = await supabase.rpc("get_user_permissions", {
    _user_id: user.id,
  });

  const realPermKeys = (permissions || []).map(
    (p: { module: string; action: string }) => `${p.module}.${p.action}`
  );

  const permissionKeys = await getEffectivePermissions(realPermKeys);

  const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  // Fetch banners from CMS
  const { data: bannersCollection } = await supabase
    .from("cms_collections")
    .select("id")
    .eq("slug", "banners")
    .single();

  let banners: { id: string; data: Record<string, unknown> }[] = [];
  if (bannersCollection) {
    const { data } = await supabase
      .from("cms_items")
      .select("id, data")
      .eq("collection_id", bannersCollection.id)
      .eq("status", "published")
      .order("sort_order");
    banners = (data || []) as typeof banners;
  }

  // Fetch recent items from key collections for dashboard tables
  async function fetchRecentItems(collectionSlug: string, limit = 3) {
    const { data: col } = await supabase
      .from("cms_collections")
      .select("id")
      .eq("slug", collectionSlug)
      .single();
    if (!col) return [];
    const { data: items } = await supabase
      .from("cms_items")
      .select("id, data, status, created_at")
      .eq("collection_id", col.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (items || []) as { id: string; data: Record<string, unknown>; status: string; created_at: string }[];
  }

  // Orders stats (for admins) or own orders (for franchise users)
  const canViewOrders = permissionKeys.includes("pedidos.view") || permissionKeys.includes("pedidos.approve");
  const canApproveOrders = permissionKeys.includes("pedidos.approve");

  let orderStats = { pendingCount: 0, monthRevenue: 0, recentOrders: [] as { id: string; status: string; total: number; created_at: string; franchise_name: string }[] };

  if (canApproveOrders) {
    // Admin: see all orders
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ count: pending }, { data: monthOrders }, { data: recent }] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["enviado", "aprovado"]),
      supabase.from("orders").select("total").gte("created_at", monthStart),
      supabase.from("orders").select("id, status, total, created_at, franchise:franchises(name)").order("created_at", { ascending: false }).limit(5),
    ]);
    orderStats = {
      pendingCount: pending || 0,
      monthRevenue: (monthOrders || []).reduce((s, o) => s + Number(o.total), 0),
      recentOrders: (recent || []).map((o) => ({
        id: o.id, status: o.status, total: o.total, created_at: o.created_at,
        franchise_name: (o.franchise as unknown as { name: string })?.name || "—",
      })),
    };
  } else if (canViewOrders && profile?.franchise_id) {
    // Franchise user: own orders
    const { data: myOrders } = await supabase
      .from("orders")
      .select("id, status, total, created_at")
      .eq("franchise_id", profile.franchise_id)
      .order("created_at", { ascending: false })
      .limit(5);
    const pending = (myOrders || []).filter((o) => ["enviado", "aprovado"].includes(o.status)).length;
    orderStats = {
      pendingCount: pending,
      monthRevenue: 0,
      recentOrders: (myOrders || []).map((o) => ({ ...o, franchise_name: "" })),
    };
  }

  const [materials, promotions, social, favorites] = await Promise.all([
    fetchRecentItems("materiais-pdv"),
    fetchRecentItems("posts-campanha"),
    fetchRecentItems("posts-redes"),
    getFavorites(),
  ]);

  // Count campaigns and materials
  const { count: campaignCount } = await supabase
    .from("cms_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .in("collection_id", (await supabase.from("cms_collections").select("id").eq("slug", "posts-campanha")).data?.map((c) => c.id) || []);

  const { count: materialCount } = await supabase
    .from("cms_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .in("collection_id", (await supabase.from("cms_collections").select("id").eq("slug", "materiais-pdv")).data?.map((c) => c.id) || []);

  return (
    <DashboardContent
      userName={userName}
      franchiseName={franchise?.name}
      permissions={permissionKeys}
      banners={banners}
      stats={{
        activeUsers: totalUsers || 0,
        activeFranchises: totalFranchises || 0,
        campaigns: campaignCount || 0,
        materials: materialCount || 0,
      }}
      recentMaterials={materials}
      recentPromotions={promotions}
      recentSocial={social}
      favorites={favorites}
      franchiseData={franchise || null}
      orderStats={orderStats}
      isOrderAdmin={canApproveOrders}
    />
  );
}
