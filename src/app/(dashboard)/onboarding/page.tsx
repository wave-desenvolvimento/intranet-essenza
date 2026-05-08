import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarding_completed, franchise:franchises(name)")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/inicio");

  const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  // Get CMS pages for the tour
  const { data: pages } = await supabase
    .from("cms_pages")
    .select("id, title, slug, icon, is_group")
    .eq("is_group", false)
    .order("sort_order")
    .limit(6);

  return (
    <OnboardingWizard
      userName={userName}
      franchiseName={franchise?.name}
      pages={(pages || []).map((p) => ({ title: p.title, slug: p.slug, icon: p.icon }))}
    />
  );
}
