import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, franchise:franchises(name)")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  return (
    <ProfileForm
      fullName={profile?.full_name || ""}
      email={user.email || ""}
      franchiseName={franchise?.name || null}
      avatarUrl={user.user_metadata?.avatar_url || ""}
    />
  );
}
