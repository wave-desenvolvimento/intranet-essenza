"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePermission } from "@/lib/permissions";

export async function trackEvent(
  itemId: string,
  collectionId: string,
  eventType: "view" | "download",
  metadata?: Record<string, unknown>
) {
  await requireAuth();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get user's franchise
  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise_id")
    .eq("id", user.id)
    .single();

  await supabase.from("analytics_events").insert({
    user_id: user.id,
    franchise_id: profile?.franchise_id || null,
    item_id: itemId,
    collection_id: collectionId,
    event_type: eventType,
    metadata: metadata || {},
  });
}

export async function getAnalyticsDashboard() {
  const p = await requirePermission("relatorios", "view"); if (p.error) return p;
  const supabase = await createClient();

  // Top items by views (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: topViewed } = await supabase
    .from("analytics_events")
    .select("item_id, cms_items!inner(data, collection_id, cms_collections(name))")
    .eq("event_type", "view")
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  const { data: topDownloaded } = await supabase
    .from("analytics_events")
    .select("item_id, cms_items!inner(data, collection_id, cms_collections(name))")
    .eq("event_type", "download")
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  // Aggregate by item
  function aggregateByItem(events: typeof topViewed) {
    const map = new Map<string, { itemId: string; title: string; collection: string; count: number }>();
    for (const e of events || []) {
      const item = e.cms_items as unknown as { data: Record<string, unknown>; cms_collections: { name: string } };
      const title = String(item.data?.titulo || item.data?.title || item.data?.nome || "Sem título");
      const collection = (item.cms_collections as { name: string })?.name || "";
      const existing = map.get(e.item_id) || { itemId: e.item_id, title, collection, count: 0 };
      existing.count++;
      map.set(e.item_id, existing);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }

  // Events by franchise
  const { data: franchiseEvents } = await supabase
    .from("analytics_events")
    .select("franchise_id, event_type, franchises(name)")
    .gte("created_at", thirtyDaysAgo)
    .limit(2000);

  function aggregateByFranchise(events: typeof franchiseEvents) {
    const map = new Map<string, { franchiseId: string; name: string; views: number; downloads: number }>();
    for (const e of events || []) {
      if (!e.franchise_id) continue;
      const franchise = e.franchises as unknown as { name: string };
      const existing = map.get(e.franchise_id) || { franchiseId: e.franchise_id, name: franchise?.name || "—", views: 0, downloads: 0 };
      if (e.event_type === "view") existing.views++;
      else if (e.event_type === "download") existing.downloads++;
      map.set(e.franchise_id, existing);
    }
    return [...map.values()].sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads));
  }

  // Totals
  const { count: totalViews } = await supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "view")
    .gte("created_at", thirtyDaysAgo);

  const { count: totalDownloads } = await supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "download")
    .gte("created_at", thirtyDaysAgo);

  // Active users (unique users with events)
  const { data: activeUserIds } = await supabase
    .from("analytics_events")
    .select("user_id")
    .gte("created_at", thirtyDaysAgo)
    .limit(5000);

  const uniqueActiveUsers = new Set((activeUserIds || []).map((e) => e.user_id)).size;

  return {
    totals: {
      views: totalViews || 0,
      downloads: totalDownloads || 0,
      activeUsers: uniqueActiveUsers,
    },
    topViewed: aggregateByItem(topViewed),
    topDownloaded: aggregateByItem(topDownloaded),
    byFranchise: aggregateByFranchise(franchiseEvents),
  };
}

export async function getOrdersAnalytics() {
  const p = await requirePermission("relatorios", "view"); if (p.error) return p;
  const supabase = await createClient();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // All orders last 30 days
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, status, total, franchise_id, created_at, franchises(name, segment), items:order_items(product_name, quantity, subtotal)")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  // Previous 30 days for comparison
  const { count: prevCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sixtyDaysAgo)
    .lt("created_at", thirtyDaysAgo);

  const { data: prevTotalData } = await supabase
    .from("orders")
    .select("total")
    .gte("created_at", sixtyDaysAgo)
    .lt("created_at", thirtyDaysAgo);

  const orders = recentOrders || [];
  const prevRevenue = (prevTotalData || []).reduce((s, o) => s + Number(o.total), 0);

  // Totals
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // By status
  const byStatus: Record<string, { count: number; revenue: number }> = {};
  for (const o of orders) {
    if (!byStatus[o.status]) byStatus[o.status] = { count: 0, revenue: 0 };
    byStatus[o.status].count++;
    byStatus[o.status].revenue += Number(o.total);
  }

  // By franchise
  const byFranchiseMap = new Map<string, { franchiseId: string; name: string; segment: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (!o.franchise_id) continue;
    const f = o.franchises as unknown as { name: string; segment: string };
    const existing = byFranchiseMap.get(o.franchise_id) || {
      franchiseId: o.franchise_id, name: f?.name || "—", segment: f?.segment || "franquia", orders: 0, revenue: 0,
    };
    existing.orders++;
    existing.revenue += Number(o.total);
    byFranchiseMap.set(o.franchise_id, existing);
  }
  const byFranchise = [...byFranchiseMap.values()].sort((a, b) => b.revenue - a.revenue);

  // Top products
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of orders) {
    const items = o.items as unknown as { product_name: string; quantity: number; subtotal: number }[];
    for (const item of items || []) {
      const existing = productMap.get(item.product_name) || { name: item.product_name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.subtotal);
      productMap.set(item.product_name, existing);
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return {
    totalRevenue,
    totalOrders,
    avgTicket,
    prevRevenue,
    prevOrders: prevCount || 0,
    byStatus,
    byFranchise,
    topProducts,
  };
}
