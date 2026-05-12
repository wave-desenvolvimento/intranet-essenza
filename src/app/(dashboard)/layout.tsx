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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user role from DB — name comes from what admin configured
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role:roles(name, level)")
    .eq("user_id", user?.id || "")
    .order("role(level)", { ascending: false })
    .limit(1)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRole = userRole?.role as any;
  const roleName = (Array.isArray(rawRole) ? rawRole[0]?.name : rawRole?.name) || null;

  const currentUser = {
    name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário",
    email: user?.email || "",
    role: roleName || "Usuário",
  };

  // Fetch pages for sidebar navigation
  const { data: cmsPages } = await supabase
    .from("cms_pages")
    .select("id, title, slug, icon, parent_id, is_group, page_type, href, module, required_action")
    .order("sort_order");

  return (
    <div className="flex min-h-dvh bg-brand-cream font-sans">
      <Sidebar cmsPages={cmsPages || []} />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-50 flex h-12 md:h-14 items-center justify-between border-b border-ink-100 bg-white px-3 md:px-5">
          <Breadcrumb />
          <div className="flex items-center gap-2 md:gap-3">
            <div data-tour="search"><GlobalSearch /></div>
            <div data-tour="notifications"><NotificationBell /></div>
            <HelpCenter />
            <div data-tour="user-menu"><UserMenu user={currentUser} /></div>
          </div>
        </header>

        <main className="flex-1 p-3 pb-20 md:px-8 md:py-7 md:pb-7">{children}</main>
      </div>
      <MobileNav cmsPages={cmsPages || []} />
      <TourAutoStart />
      <InstallPrompt />
      <SwRegister />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
