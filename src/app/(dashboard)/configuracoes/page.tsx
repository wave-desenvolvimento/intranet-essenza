import { getRoles, getPermissions } from "./actions";
import { PermissionsManager } from "./permissions-manager";

export default async function ConfiguracoesPage() {
  const [roles, permissions] = await Promise.all([getRoles(), getPermissions()]);

  return <PermissionsManager roles={roles} permissions={permissions} />;
}
