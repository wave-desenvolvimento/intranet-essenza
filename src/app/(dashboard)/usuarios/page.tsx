import { getUsers, getFranchises, getRoles } from "./actions";
import { UsersManager } from "./users-manager";

export default async function UsuariosPage() {
  const [users, franchises, roles] = await Promise.all([
    getUsers(),
    getFranchises(),
    getRoles(),
  ]);

  return (
    <div>
      <UsersManager users={users} franchises={franchises} roles={roles} />
    </div>
  );
}
