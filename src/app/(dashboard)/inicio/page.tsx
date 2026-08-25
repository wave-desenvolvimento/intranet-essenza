import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./dashboard-content";
import { getFavorites } from "../favorites-actions";
import { getEffectivePermissions } from "@/lib/dev-mode-server"; // kept for dev mode switcher

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // === Batch 1: Independent queries in parallel ===
  const [
    { data: profile },
    { count: totalUsers },
    { count: totalFranchises },
    { data: permissions },
    { data: recentAnnouncements },
    { data: collections },
    favorites,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, franchise_id, franchise:franchises(id, name, segment)")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("franchises")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.rpc("get_user_permissions", { _user_id: user.id }),
    supabase
      .from("announcements")
      .select("id, title, body, priority, banner_url, created_at, target_type")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
    // Batch all collection lookups into one query
    supabase
      .from("cms_collections")
      .select("id, slug")
      .in("slug", ["banners", "materiais-pdv", "posts-campanha", "posts-redes"]),
    getFavorites(),
  ]);

  const realPermKeys = (permissions || []).map(
    (p: { module: string; action: string }) => `${p.module}.${p.action}`
  );
  const permissionKeys = await getEffectivePermissions(realPermKeys);

  const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  // Map collection slugs to IDs (single query, reused everywhere)
  const colMap = new Map((collections || []).map((c) => [c.slug, c.id]));

  const bannersColId = colMap.get("banners");
  const materiaisColId = colMap.get("materiais-pdv");
  const campanhaColId = colMap.get("posts-campanha");
  const redesColId = colMap.get("posts-redes");

  // === Batch 2: Queries that depend on batch 1 results ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (builder: PromiseLike<any>) => Promise.resolve(builder);

  const recentItemsQuery = (collectionId: string | undefined, limit = 3) => {
    if (!collectionId) return Promise.resolve({ data: null });
    return q(supabase
      .from("cms_items")
      .select("id, data, status, created_at")
      .eq("collection_id", collectionId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(limit));
  };

  // Orders + CMS items + counts - all in parallel
  const canViewOrders = permissionKeys.includes("pedidos.view") || permissionKeys.includes("pedidos.approve");
  const canApproveOrders = permissionKeys.includes("pedidos.approve");

  const batch2Promises: Promise<unknown>[] = [
    // Banners
    bannersColId
      ? q(supabase.from("cms_items").select("id, data").eq("collection_id", bannersColId).eq("status", "published").order("sort_order"))
      : Promise.resolve({ data: null }),
    // Recent items (3 collections)
    recentItemsQuery(materiaisColId),
    recentItemsQuery(campanhaColId),
    recentItemsQuery(redesColId),
    // Counts (reuse colMap IDs directly, no subquery)
    campanhaColId
      ? q(supabase.from("cms_items").select("*", { count: "exact", head: true }).eq("status", "published").eq("collection_id", campanhaColId))
      : Promise.resolve({ count: 0 }),
    materiaisColId
      ? q(supabase.from("cms_items").select("*", { count: "exact", head: true }).eq("status", "published").eq("collection_id", materiaisColId))
      : Promise.resolve({ count: 0 }),
  ];

  // Orders (conditional)
  let orderStatsPromise: Promise<unknown>;
  if (canApproveOrders) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    orderStatsPromise = Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pendente"]),
      supabase.from("orders").select("total").gte("created_at", monthStart),
      supabase.from("orders").select("id, status, total, created_at, franchise:franchises(name)").order("created_at", { ascending: false }).limit(5),
    ]);
  } else if (canViewOrders && profile?.franchise_id) {
    orderStatsPromise = q(supabase
      .from("orders")
      .select("id, status, total, created_at")
      .eq("franchise_id", profile.franchise_id)
      .order("created_at", { ascending: false })
      .limit(5));
  } else {
    orderStatsPromise = Promise.resolve(null);
  }

  batch2Promises.push(orderStatsPromise);

  const [
    bannersResult,
    materialsResult,
    promotionsResult,
    socialResult,
    campaignCountResult,
    materialCountResult,
    orderResult,
  ] = await Promise.all(batch2Promises) as [
    { data: { id: string; data: Record<string, unknown> }[] | null },
    { data: { id: string; data: Record<string, unknown>; status: string; created_at: string }[] | null },
    { data: { id: string; data: Record<string, unknown>; status: string; created_at: string }[] | null },
    { data: { id: string; data: Record<string, unknown>; status: string; created_at: string }[] | null },
    { count: number | null },
    { count: number | null },
    unknown,
  ];

  const banners = (bannersResult.data || []) as { id: string; data: Record<string, unknown> }[];
  const materials = (materialsResult.data || []) as { id: string; data: Record<string, unknown>; status: string; created_at: string }[];
  const promotions = (promotionsResult.data || []) as { id: string; data: Record<string, unknown>; status: string; created_at: string }[];
  const social = (socialResult.data || []) as { id: string; data: Record<string, unknown>; status: string; created_at: string }[];

  // Build order stats
  let orderStats = { pendingCount: 0, monthRevenue: 0, recentOrders: [] as { id: string; status: string; total: number; created_at: string; franchise_name: string }[] };

  if (canApproveOrders && Array.isArray(orderResult)) {
    const [{ count: pending }, { data: monthOrders }, { data: recent }] = orderResult as [
      { count: number | null },
      { data: { total: number }[] | null },
      { data: { id: string; status: string; total: number; created_at: string; franchise: unknown }[] | null },
    ];
    orderStats = {
      pendingCount: pending || 0,
      monthRevenue: (monthOrders || []).reduce((s, o) => s + Number(o.total), 0),
      recentOrders: (recent || []).map((o) => ({
        id: o.id, status: o.status, total: o.total, created_at: o.created_at,
        franchise_name: (o.franchise as unknown as { name: string })?.name || "-",
      })),
    };
  } else if (canViewOrders && profile?.franchise_id && orderResult && typeof orderResult === "object" && "data" in (orderResult as Record<string, unknown>)) {
    const myOrders = ((orderResult as { data: { id: string; status: string; total: number; created_at: string }[] | null }).data || []);
    const pending = myOrders.filter((o) => o.status === "pendente").length;
    orderStats = {
      pendingCount: pending,
      monthRevenue: 0,
      recentOrders: myOrders.map((o) => ({ ...o, franchise_name: "" })),
    };
  }

  return (
    <DashboardContent
      userName={userName}
      franchiseName={franchise?.name}
      permissions={permissionKeys}
      banners={banners}
      stats={{
        activeUsers: totalUsers || 0,
        activeFranchises: totalFranchises || 0,
        campaigns: campaignCountResult.count || 0,
        materials: materialCountResult.count || 0,
      }}
      recentMaterials={materials}
      recentPromotions={promotions}
      recentSocial={social}
      favorites={favorites}
      franchiseData={franchise || null}
      orderStats={orderStats}
      isOrderAdmin={canApproveOrders}
      announcements={recentAnnouncements || []}
    />
  );
}
