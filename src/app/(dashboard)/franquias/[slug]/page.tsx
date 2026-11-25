import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchiseUsers } from "../actions";
import { getFranchiseStock } from "../stock-actions";
import { getFranchiseTraining } from "@/app/(dashboard)/acompanhamento/franchise-training";
import { FranchiseDetail } from "./franchise-detail";
import { StockTab } from "./stock-tab";
import { getRolesForContext, getUserScope, requirePermission } from "@/lib/permissions";

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await requirePermission("franquias", "view");
  if (p.error) notFound();
  const supabase = await createClient();

  // Franchise + auth em paralelo
  const [franchiseRes, { data: { user } }] = await Promise.all([
    supabase.from("franchises").select("*").eq("slug", slug).single(),
    supabase.auth.getUser(),
  ]);

  const franchise = franchiseRes.data;
  if (!franchise) notFound();

  const userId = user?.id || "";

  // Profile, permissao, users, roles, stock - tudo em paralelo
  const scope = await getUserScope(userId);
  if (!scope.isStaff && scope.franchiseId !== franchise.id) notFound();

  const [canCreateRes, canEditRes, users, availableRoles, stock, trainingTab] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: userId, _module: "usuarios", _action: "create" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "usuarios", _action: "edit" }),
    getFranchiseUsers(franchise.id),
    getRolesForContext(userId),
    getFranchiseStock(franchise.id),
    getFranchiseTraining(userId, franchise.id),
  ]);

  const canManageUsers = !!canCreateRes.data && !!canEditRes.data;

  return (
    <FranchiseDetail
      franchise={franchise}
      users={users}
      roles={availableRoles}
      canManageUsers={canManageUsers}
      isStaff={scope.isStaff}
      canManageRoles={canManageUsers}
      trainingTab={trainingTab}
      stockTab={<StockTab franchiseId={franchise.id} stock={stock} canEdit={canManageUsers} />}
    />
  );
}
