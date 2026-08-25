import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchiseUsers } from "../actions";
import { getFranchiseStock } from "../stock-actions";
import { FranchiseDetail } from "./franchise-detail";
import { StockTab } from "./stock-tab";
import { getRolesForContext } from "@/lib/permissions";

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
  const [profileRes, canManageRolesRes, users, availableRoles, stock] = await Promise.all([
    supabase.from("profiles").select("franchise_id, is_franchise_admin").eq("id", userId).single(),
    supabase.rpc("has_permission", { _user_id: userId, _module: "usuarios", _action: "manage" }),
    getFranchiseUsers(franchise.id),
    getRolesForContext(userId),
    getFranchiseStock(franchise.id),
  ]);

  const isFranchiseAdmin = !!profileRes.data?.is_franchise_admin && profileRes.data?.franchise_id === franchise.id;
  const canManageUsers = !!canManageRolesRes.data || isFranchiseAdmin;

  return (
    <FranchiseDetail
      franchise={franchise}
      users={users}
      roles={availableRoles}
      canManageUsers={canManageUsers}
      canManageRoles={!!canManageRolesRes.data}
      stockTab={<StockTab franchiseId={franchise.id} stock={stock} canEdit={canManageUsers} />}
    />
  );
}
