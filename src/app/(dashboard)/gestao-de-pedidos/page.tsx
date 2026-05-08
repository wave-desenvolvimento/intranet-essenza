import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getAllOrders, getOrderStats } from "@/app/(dashboard)/novo-pedido/actions";
import { OrdersAdmin } from "./orders-admin";
import { getEffectivePermissions } from "@/lib/dev-mode-server";

export default async function OrdersAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check permission
  const { data: perms } = await supabase.rpc("get_user_permissions", { _user_id: user?.id });
  const realPermKeys = (perms || []).map((p: { module: string; action: string }) => `${p.module}.${p.action}`);
  const effectivePerms = await getEffectivePermissions(realPermKeys);

  if (!effectivePerms.includes("pedidos.view_all")) notFound();

  const canApprove = effectivePerms.includes("pedidos.approve");
  const canEdit = effectivePerms.includes("pedidos.edit");
  const canExport = effectivePerms.includes("pedidos.export");
  const canDelete = effectivePerms.includes("pedidos.delete");
  const canManageProducts = effectivePerms.includes("pedidos.manage");

  const orders = await getAllOrders();
  const stats = await getOrderStats();

  const { data: franchises } = await supabase
    .from("franchises")
    .select("id, name, status")
    .order("name");

  return (
    <OrdersAdmin
      orders={orders}
      stats={stats}
      franchises={franchises || []}
      permissions={{ canApprove, canEdit, canExport, canDelete, canManageProducts }}
    />
  );
}
