import { createClient } from "@/lib/supabase/server";
import { getUsers, getFranchises, getRoles } from "./actions";
import { UsersManager } from "./users-manager";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [users, franchises, roles] = await Promise.all([
    getUsers(),
    getFranchises(),
    getRoles(),
  ]);

  return (
    <div>
      <UsersManager users={users} franchises={franchises} roles={roles} currentUserId={user!.id} />
    </div>
  );
}
