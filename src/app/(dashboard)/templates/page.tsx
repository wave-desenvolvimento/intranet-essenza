import { createClient } from "@/lib/supabase/server";
import { getTemplates } from "./actions";
import { TemplatesModule } from "./templates-module";
import { isSystemAdmin } from "@/lib/permissions";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const templates = await getTemplates();
  const isAdmin = await isSystemAdmin(user?.id || "");

  // Get franchise data for rendering
  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise:franchises(*)")
    .eq("id", user?.id || "")
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  return <TemplatesModule templates={templates} isAdmin={isAdmin} franchiseData={franchise || null} />;
}
