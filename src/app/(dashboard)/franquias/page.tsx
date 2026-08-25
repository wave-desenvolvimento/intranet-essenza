import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FranchisesManager } from "./franchises-manager";

export default async function FranquiasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile + permissao em paralelo
  const [profileRes, isGlobalAdminRes] = await Promise.all([
    supabase.from("profiles").select("franchise_id, is_franchise_admin, franchise:franchises(slug)").eq("id", user.id).single(),
    supabase.rpc("has_permission", { _user_id: user.id, _module: "usuarios", _action: "manage" }),
  ]);

  // Franqueado: redireciona direto pro detalhe da franquia dele
  if (profileRes.data?.franchise_id && profileRes.data?.franchise && !isGlobalAdminRes.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const franchise = profileRes.data.franchise as any;
    const slug = Array.isArray(franchise) ? franchise[0]?.slug : franchise?.slug;
    if (slug) redirect(`/franquias/${slug}`);
  }

  // Dados admin - tudo em paralelo
  const [franchisesRes, commercialRoleRes] = await Promise.all([
    supabase.from("franchises").select("*, profiles(id, status)").order("name"),
    supabase.from("roles").select("id").eq("name", "Comercial Matriz").single(),
  ]);

  // Buscar usuarios comerciais
  let commercialUsers: { id: string; full_name: string }[] = [];
  if (commercialRoleRes.data) {
    const { data: userRoles } = await supabase.from("user_roles").select("user_id").eq("role_id", commercialRoleRes.data.id);
    if (userRoles?.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userRoles.map((ur) => ur.user_id));
      commercialUsers = profiles || [];
    }
  }

  const franchises = (franchisesRes.data || []).map((f) => ({
    ...f,
    totalUsers: f.profiles?.length || 0,
    activeUsers: f.profiles?.filter((p: { status: string }) => p.status === "active").length || 0,
    inactiveUsers: f.profiles?.filter((p: { status: string }) => p.status === "inactive").length || 0,
  }));

  return (
    <div>
      <FranchisesManager franchises={franchises} commercialUsers={commercialUsers} />
    </div>
  );
}
