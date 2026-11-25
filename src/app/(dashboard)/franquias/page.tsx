import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserScope, requirePermission } from "@/lib/permissions";
import { FranchisesManager } from "./franchises-manager";

export default async function FranquiasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const p = await requirePermission("franquias", "view");
  if (p.error) notFound();

  // Profile + escopo em paralelo
  const [profileRes, scope] = await Promise.all([
    supabase.from("profiles").select("franchise_id, is_franchise_admin, franchise:franchises(slug)").eq("id", user.id).single(),
    getUserScope(user.id),
  ]);

  // Franqueado: redireciona direto pro detalhe da franquia dele
  if (profileRes.data?.franchise_id && profileRes.data?.franchise && !scope.isStaff) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const franchise = profileRes.data.franchise as any;
    const slug = Array.isArray(franchise) ? franchise[0]?.slug : franchise?.slug;
    if (slug) redirect(`/franquias/${slug}`);
  }
  if (!scope.isStaff) notFound();

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
