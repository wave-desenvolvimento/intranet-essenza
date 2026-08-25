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

export async function trackPageView(pagePath: string, module: string, pageTitle?: string, sessionId?: string) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("franchise_id")
      .eq("id", user.id)
      .single();

    await supabase.from("page_views").insert({
      user_id: user.id,
      franchise_id: profile?.franchise_id || null,
      page_path: pagePath,
      module,
      page_title: pageTitle || null,
      session_id: sessionId || null,
    });
  } catch {
    // Page view tracking should never break navigation
  }
}

export async function getAnalyticsDashboard(from?: string, to?: string) {
  const p = await requirePermission("relatorios", "view"); if (p.error) return p;
  const supabase = await createClient();

  const dateFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = to || new Date().toISOString();
  const thirtyDaysAgo = dateFrom;

  // Todas as queries em paralelo
  const [topViewedRes, topDownloadedRes, franchiseEventsRes, totalViewsRes, totalDownloadsRes, activeUserIdsRes] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("item_id, cms_items!inner(data, collection_id, cms_collections(name))")
      .eq("event_type", "view")
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .limit(500),
    supabase
      .from("analytics_events")
      .select("item_id, cms_items!inner(data, collection_id, cms_collections(name))")
      .eq("event_type", "download")
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .limit(500),
    supabase
      .from("analytics_events")
      .select("franchise_id, event_type, franchises(name)")
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .limit(2000),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "view").gte("created_at", dateFrom).lte("created_at", dateTo),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "download").gte("created_at", dateFrom).lte("created_at", dateTo),
    supabase.from("analytics_events").select("user_id").gte("created_at", dateFrom).lte("created_at", dateTo).limit(5000),
  ]);

  const topViewed = topViewedRes.data;
  const topDownloaded = topDownloadedRes.data;
  const franchiseEvents = franchiseEventsRes.data;

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

  function aggregateByFranchise(events: typeof franchiseEvents) {
    const map = new Map<string, { franchiseId: string; name: string; views: number; downloads: number }>();
    for (const e of events || []) {
      if (!e.franchise_id) continue;
      const franchise = e.franchises as unknown as { name: string };
      const existing = map.get(e.franchise_id) || { franchiseId: e.franchise_id, name: franchise?.name || "-", views: 0, downloads: 0 };
      if (e.event_type === "view") existing.views++;
      else if (e.event_type === "download") existing.downloads++;
      map.set(e.franchise_id, existing);
    }
    return [...map.values()].sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads));
  }

  const uniqueActiveUsers = new Set((activeUserIdsRes.data || []).map((e) => e.user_id)).size;

  return {
    totals: {
      views: totalViewsRes.count || 0,
      downloads: totalDownloadsRes.count || 0,
      activeUsers: uniqueActiveUsers,
    },
    topViewed: aggregateByItem(topViewed),
    topDownloaded: aggregateByItem(topDownloaded),
    byFranchise: aggregateByFranchise(franchiseEvents),
  };
}

export async function getOrdersAnalytics(from?: string, to?: string) {
  const p = await requirePermission("relatorios", "view"); if (p.error) return p;
  const supabase = await createClient();

  const now = new Date();
  const dateFrom = from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = to || now.toISOString();
  // Previous period: same duration before dateFrom
  const periodMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
  const prevFrom = new Date(new Date(dateFrom).getTime() - periodMs).toISOString();

  const [recentOrdersRes, prevCountRes, prevTotalRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total, franchise_id, created_at, franchises(name, segment), items:order_items(product_name, quantity, subtotal)")
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", prevFrom).lt("created_at", dateFrom),
    supabase.from("orders").select("total").gte("created_at", prevFrom).lt("created_at", dateFrom),
  ]);

  const recentOrders = recentOrdersRes.data;
  const prevCount = prevCountRes.count;
  const prevTotalData = prevTotalRes.data;

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
      franchiseId: o.franchise_id, name: f?.name || "-", segment: f?.segment || "franquia", orders: 0, revenue: 0,
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

// ===================================================
// DETAILED FRANCHISE & USER ACTIVITY ANALYTICS
// ===================================================

const MODULE_LABELS: Record<string, string> = {
  inicio: "Início", pedidos: "Pedidos", franquias: "Franquias", usuarios: "Usuários",
  comunicados: "Comunicados", faq: "FAQ", pesquisas: "Pesquisas", relatorios: "Relatórios",
  biblioteca: "Biblioteca", cms: "CMS", templates: "Templates", configuracoes: "Configurações",
  "universo-da-marca": "Universo da Marca", "material-corporativo": "Material Corp.",
  campanhas: "Campanhas", "redes-sociais": "Redes Sociais", videos: "Vídeos",
  treinamento: "Treinamento", cigam: "CIGAM", outro: "Outro",
};

export async function getDetailedAnalytics(from?: string, to?: string) {
  const p = await requirePermission("relatorios", "view"); if (p.error) return p;
  const supabase = await createClient();

  const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = to || new Date().toISOString();

  // 1. Page views by module (aggregated)
  const { data: pageViewsRaw } = await supabase
    .from("page_views")
    .select("module, franchise_id, user_id, created_at, franchises(name)")
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: false })
    .limit(10000);

  const pvRows = pageViewsRaw || [];

  // Module usage aggregation
  const moduleMap = new Map<string, { module: string; label: string; views: number; uniqueUsers: Set<string>; uniqueFranchises: Set<string> }>();
  for (const pv of pvRows) {
    const m = pv.module;
    const existing = moduleMap.get(m) || { module: m, label: MODULE_LABELS[m] || m, views: 0, uniqueUsers: new Set(), uniqueFranchises: new Set() };
    existing.views++;
    if (pv.user_id) existing.uniqueUsers.add(pv.user_id);
    if (pv.franchise_id) existing.uniqueFranchises.add(pv.franchise_id);
    moduleMap.set(m, existing);
  }
  const moduleUsage = [...moduleMap.values()]
    .map((m) => ({ module: m.module, label: m.label, views: m.views, uniqueUsers: m.uniqueUsers.size, uniqueFranchises: m.uniqueFranchises.size }))
    .sort((a, b) => b.views - a.views);

  // 2. Franchise detailed breakdown (modules per franchise, active users, last activity)
  const franchiseDetailMap = new Map<string, {
    franchiseId: string; name: string;
    totalPageViews: number;
    modules: Map<string, number>;
    users: Map<string, { name: string; pageViews: number; lastSeen: string }>;
    lastActivity: string;
  }>();

  // Fetch user profiles in batch for name resolution
  const userIds = [...new Set(pvRows.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, franchise_id").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  for (const pv of pvRows) {
    if (!pv.franchise_id) continue;
    const fName = (pv.franchises as unknown as { name: string })?.name || "-";
    const existing = franchiseDetailMap.get(pv.franchise_id) || {
      franchiseId: pv.franchise_id, name: fName,
      totalPageViews: 0, modules: new Map(), users: new Map(), lastActivity: pv.created_at,
    };
    existing.totalPageViews++;

    // Module count
    existing.modules.set(pv.module, (existing.modules.get(pv.module) || 0) + 1);

    // User activity
    if (pv.user_id) {
      const profile = profileMap.get(pv.user_id);
      const userName = profile?.full_name || pv.user_id.slice(0, 8);
      const userEntry = existing.users.get(pv.user_id) || { name: userName, pageViews: 0, lastSeen: pv.created_at };
      userEntry.pageViews++;
      if (pv.created_at > userEntry.lastSeen) userEntry.lastSeen = pv.created_at;
      existing.users.set(pv.user_id, userEntry);
    }

    if (pv.created_at > existing.lastActivity) existing.lastActivity = pv.created_at;
    franchiseDetailMap.set(pv.franchise_id, existing);
  }

  // Todas as queries adicionais em paralelo
  const [contentEventsRes, allActiveProfilesRes, ordersInPeriodRes, surveyResponsesRes, announcementReadsRes] = await Promise.all([
    supabase.from("analytics_events").select("franchise_id, event_type, user_id").gte("created_at", dateFrom).lte("created_at", dateTo).limit(5000),
    supabase.from("profiles").select("id, franchise_id").eq("status", "active"),
    supabase.from("orders").select("franchise_id, total").gte("created_at", dateFrom).lte("created_at", dateTo),
    supabase.from("survey_responses").select("user_id, franchise_id").gte("created_at", dateFrom).lte("created_at", dateTo),
    supabase.from("announcement_reads").select("user_id").gte("read_at", dateFrom).lte("read_at", dateTo),
  ]);

  const contentByFranchise = new Map<string, { views: number; downloads: number }>();
  for (const e of contentEventsRes.data || []) {
    if (!e.franchise_id) continue;
    const existing = contentByFranchise.get(e.franchise_id) || { views: 0, downloads: 0 };
    if (e.event_type === "view") existing.views++;
    else if (e.event_type === "download") existing.downloads++;
    contentByFranchise.set(e.franchise_id, existing);
  }

  const allActiveProfiles = allActiveProfilesRes.data || [];
  const totalUsersByFranchise = new Map<string, number>();
  for (const p of allActiveProfiles) {
    if (!p.franchise_id) continue;
    totalUsersByFranchise.set(p.franchise_id, (totalUsersByFranchise.get(p.franchise_id) || 0) + 1);
  }

  const ordersByFranchise = new Map<string, { count: number; revenue: number }>();
  for (const o of ordersInPeriodRes.data || []) {
    if (!o.franchise_id) continue;
    const existing = ordersByFranchise.get(o.franchise_id) || { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += Number(o.total);
    ordersByFranchise.set(o.franchise_id, existing);
  }

  const surveysByFranchise = new Map<string, number>();
  for (const sr of surveyResponsesRes.data || []) {
    const fId = sr.franchise_id;
    if (!fId) continue;
    surveysByFranchise.set(fId, (surveysByFranchise.get(fId) || 0) + 1);
  }

  // Build a user->franchise map from all active profiles already fetched
  const userFranchiseMap = new Map<string, string>();
  for (const p of allActiveProfiles) {
    if (p.franchise_id) userFranchiseMap.set(p.id, p.franchise_id);
  }

  const announcementsByFranchise = new Map<string, number>();
  for (const ar of announcementReadsRes.data || []) {
    const fId = userFranchiseMap.get(ar.user_id);
    if (!fId) continue;
    announcementsByFranchise.set(fId, (announcementsByFranchise.get(fId) || 0) + 1);
  }

  // Also fetch all franchises to show ones with zero activity
  const { data: allFranchises } = await supabase
    .from("franchises")
    .select("id, name")
    .eq("status", "active");

  // Build final franchise detail array
  const franchiseDetails = (allFranchises || []).map((f) => {
    const detail = franchiseDetailMap.get(f.id);
    const content = contentByFranchise.get(f.id);
    const orders = ordersByFranchise.get(f.id);
    const modulesArr = detail
      ? [...detail.modules.entries()].map(([mod, count]) => ({ module: mod, label: MODULE_LABELS[mod] || mod, count })).sort((a, b) => b.count - a.count)
      : [];
    const usersArr = detail
      ? [...detail.users.values()].sort((a, b) => b.pageViews - a.pageViews)
      : [];
    return {
      franchiseId: f.id,
      name: f.name,
      totalPageViews: detail?.totalPageViews || 0,
      contentViews: content?.views || 0,
      contentDownloads: content?.downloads || 0,
      activeUsers: usersArr.length,
      lastActivity: detail?.lastActivity || null,
      modules: modulesArr,
      users: usersArr,
      totalUsers: totalUsersByFranchise.get(f.id) || 0,
      ordersCount: orders?.count || 0,
      ordersRevenue: orders?.revenue || 0,
      surveysResponded: surveysByFranchise.get(f.id) || 0,
      announcementsRead: announcementsByFranchise.get(f.id) || 0,
    };
  }).sort((a, b) => b.totalPageViews - a.totalPageViews);

  // 3. Recent activity log (last 50 actions across audit + page views)
  const { data: recentAudit } = await supabase
    .from("audit_log")
    .select("id, user_id, user_name, action, entity_type, description, created_at")
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: false })
    .limit(100);

  // Enrich audit with franchise info
  const auditUserIds = [...new Set((recentAudit || []).map((a) => a.user_id).filter(Boolean))];
  const { data: auditProfiles } = auditUserIds.length > 0
    ? await supabase.from("profiles").select("id, franchise_id, franchises(name)").in("id", auditUserIds)
    : { data: [] };
  const auditProfileMap = new Map((auditProfiles || []).map((p) => [p.id, p]));

  const activityLog = (recentAudit || []).map((a) => {
    const profile = auditProfileMap.get(a.user_id);
    const franchise = profile?.franchises as unknown as { name: string } | null;
    return {
      id: a.id,
      userName: a.user_name,
      action: a.action,
      entityType: a.entity_type,
      description: a.description,
      franchiseName: franchise?.name || null,
      createdAt: a.created_at,
    };
  });

  // 4. Total page views count
  const { count: totalPageViews } = await supabase
    .from("page_views")
    .select("*", { count: "exact", head: true })
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo);

  // 5. Unique sessions
  const sessionSet = new Set(pvRows.map((r) => r.user_id).filter(Boolean));

  return {
    totalPageViews: totalPageViews || 0,
    totalSessions: sessionSet.size,
    moduleUsage,
    franchiseDetails,
    activityLog,
  };
}
