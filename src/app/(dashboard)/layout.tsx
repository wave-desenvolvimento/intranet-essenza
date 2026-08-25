import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { HelpCenter } from "@/components/layout/help-center";
import { TourAutoStart } from "@/components/layout/tour-auto-start";
import { MobileNav } from "@/components/layout/mobile-nav";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { SwRegister } from "@/components/layout/sw-register";
import { Toaster } from "sonner";
import { SurveyWidget } from "@/components/layout/survey-widget";
import { PageViewTracker } from "@/components/layout/page-view-tracker";
import { IdleLogout } from "@/components/layout/idle-logout";
import { PageTransition } from "@/components/layout/page-transition";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // All layout queries in parallel
  const [{ data: userRole }, { data: allActiveSurveys }, { data: respondedSurveys }, { data: cmsPages }, { data: permissions }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role:roles(name, level)")
      .eq("user_id", user?.id || "")
      .order("role(level)", { ascending: false })
      .limit(1)
      .single(),
    // Single query: all active surveys with questions
    supabase
      .from("surveys")
      .select("id, title, description, questions:survey_questions(id, label, type, options, required, sort_order)")
      .eq("active", true),
    // Just the IDs this user already responded to
    supabase
      .from("survey_responses")
      .select("survey_id")
      .eq("user_id", user?.id || ""),
    supabase
      .from("cms_pages")
      .select("id, title, slug, icon, parent_id, is_group, page_type, href, module, required_action")
      .order("sort_order"),
    // Permissions for sidebar (avoids client-side fetch + skeleton flash)
    supabase.rpc("get_user_permissions", { _user_id: user?.id || "" }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRole = userRole?.role as any;
  const roleName = (Array.isArray(rawRole) ? rawRole[0]?.name : rawRole?.name) || null;

  const currentUser = {
    name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário",
    email: user?.email || "",
    role: roleName || "Usuário",
    avatarUrl: user?.user_metadata?.avatar_url || "",
  };

  // Compute permission keys for sidebar
  const realPermKeys = (permissions || []).map(
    (p: { module: string; action: string }) => `${p.module}.${p.action}`
  );
  const permissionKeys = await getEffectivePermissions(realPermKeys);

  // Filter surveys: active ones user hasn't responded to
  const respondedIds = new Set((respondedSurveys || []).map((r: { survey_id: string }) => r.survey_id));
  const pendingSurveys = (allActiveSurveys || [])
    .filter((s) => !respondedIds.has(s.id))
    .map((s) => ({
      ...s,
      questions: (s.questions || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    }));

  return (
    <div className="flex min-h-dvh bg-brand-cream font-sans">
      <Sidebar cmsPages={cmsPages || []} permissionKeys={permissionKeys} />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-50 flex h-12 md:h-14 items-center justify-between border-b border-ink-100 bg-white px-3 md:px-5">
          <Breadcrumb />
          <div className="flex items-center gap-2 md:gap-3">
            <div data-tour="search"><GlobalSearch /></div>
            <div data-tour="notifications"><NotificationBell /></div>
            <SurveyWidget surveys={pendingSurveys} />
            <HelpCenter />
            <div data-tour="user-menu"><UserMenu user={currentUser} /></div>
          </div>
        </header>

        <main className="flex-1 p-3 pb-20 md:px-8 md:py-7 md:pb-7">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <MobileNav cmsPages={cmsPages || []} permissionKeys={permissionKeys} />
      <TourAutoStart />
      <InstallPrompt />
      <SwRegister />
      <PageViewTracker />
      <IdleLogout />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
