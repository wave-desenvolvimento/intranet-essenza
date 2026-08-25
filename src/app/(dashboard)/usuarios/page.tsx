import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "./users-manager";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [usersRes, franchisesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, franchise:franchises(id, name, slug), user_roles(user_id, role_id, role:roles(id, name))")
      .order("created_at", { ascending: false }),
    supabase.from("franchises").select("*").eq("status", "active").order("name"),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  const users = (usersRes.data || []).map((p) => ({ ...p, user_roles: p.user_roles || [] }));

  return (
    <div>
      <UsersManager users={users} franchises={franchisesRes.data || []} roles={rolesRes.data || []} currentUserId={user!.id} />
    </div>
  );
}
