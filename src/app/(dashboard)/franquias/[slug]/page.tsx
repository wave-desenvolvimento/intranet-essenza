import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchiseBySlug, getFranchiseUsers } from "../actions";
import { getFranchiseStock } from "../stock-actions";
import { FranchiseDetail } from "./franchise-detail";
import { StockTab } from "./stock-tab";
import { isSystemAdmin as checkSystemAdmin, getRolesForContext } from "@/lib/permissions";

export default async function FranchiseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const franchise = await getFranchiseBySlug(slug);

  if (!franchise) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise_id, is_franchise_admin")
    .eq("id", userId)
    .single();

  const isSysAdmin = await checkSystemAdmin(userId);
  const isFranchiseAdmin = !!profile?.is_franchise_admin && profile?.franchise_id === franchise.id;
  const canManageUsers = isSysAdmin || isFranchiseAdmin;

  const [users, availableRoles, stock] = await Promise.all([
    getFranchiseUsers(franchise.id),
    getRolesForContext(userId),
    getFranchiseStock(franchise.id),
  ]);

  return (
    <FranchiseDetail
      franchise={franchise}
      users={users}
      roles={availableRoles}
      canManageUsers={canManageUsers}
      isSystemAdmin={isSysAdmin}
      stockTab={<StockTab franchiseId={franchise.id} stock={stock} canEdit={canManageUsers} />}
    />
  );
}
