import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolesForContext, getUserScope, requirePermission } from "@/lib/permissions";
import { getFranchiseUsers } from "../franquias/actions";
import { getFranchiseTraining } from "../acompanhamento/franchise-training";
import { FranchiseDetail } from "../franquias/[slug]/franchise-detail";
import { UsersManager } from "./users-manager";

export default async function UsuariosPage() {
  const p = await requirePermission("usuarios", "view");
  if (p.error) notFound();
  const userId = p.user!.id;
  const supabase = await createClient();
  const scope = await getUserScope(userId);

  // Franqueado: so a propria loja
  if (!scope.isStaff) {
    if (!scope.franchiseId) notFound();
    const [franchiseRes, users, roles, canCreateRes, canEditRes, trainingTab] = await Promise.all([
      supabase.from("franchises").select("*").eq("id", scope.franchiseId).single(),
      getFranchiseUsers(scope.franchiseId),
      getRolesForContext(userId),
      supabase.rpc("has_permission", { _user_id: userId, _module: "usuarios", _action: "create" }),
      supabase.rpc("has_permission", { _user_id: userId, _module: "usuarios", _action: "edit" }),
      getFranchiseTraining(userId, scope.franchiseId),
    ]);
    if (!franchiseRes.data) notFound();
    const canManage = !!canCreateRes.data && !!canEditRes.data;
    return (
      <div>
        <FranchiseDetail
          franchise={franchiseRes.data}
          users={users}
          roles={roles}
          canManageUsers={canManage}
          canManageRoles={canManage}
          isStaff={false}
          trainingTab={trainingTab}
        />
      </div>
    );
  }

  const [usersRes, franchisesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, franchise:franchises(id, name, slug)")
      .order("created_at", { ascending: false }),
    supabase.from("franchises").select("*").eq("status", "active").order("name"),
    supabase.from("user_roles").select("user_id, role_id, role:roles(id, name)"),
  ]);

  // Roles em query separada: o PostgREST nao infere o join profiles -> user_roles
  const users = (usersRes.data || []).map((profile) => ({
    ...profile,
    user_roles: (rolesRes.data || [])
      .filter((ur) => ur.user_id === profile.id)
      .map((ur) => ({ role_id: ur.role_id, role: Array.isArray(ur.role) ? ur.role[0] : ur.role })),
  }));

  return (
    <div>
      <UsersManager users={users} franchises={franchisesRes.data || []} currentUserId={userId} />
    </div>
  );
}
