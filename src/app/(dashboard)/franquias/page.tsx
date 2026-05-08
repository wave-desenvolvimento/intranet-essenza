import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchises } from "./actions";
import { FranchisesManager } from "./franchises-manager";

export default async function FranquiasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("franchise_id, is_franchise_admin, franchise:franchises(slug)")
      .eq("id", user.id)
      .single();

    // Franqueado: redireciona direto pro detalhe da franquia dele
    if (profile?.franchise_id && profile?.franchise) {
      const { data: isGlobalAdmin } = await supabase.rpc("has_permission", {
        _user_id: user.id,
        _module: "usuarios",
        _action: "manage",
      });

      if (!isGlobalAdmin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const franchise = profile.franchise as any;
        const slug = Array.isArray(franchise) ? franchise[0]?.slug : franchise?.slug;
        if (slug) redirect(`/franquias/${slug}`);
      }
    }
  }

  const franchises = await getFranchises();

  return (
    <div>
      <FranchisesManager franchises={franchises} />
    </div>
  );
}
