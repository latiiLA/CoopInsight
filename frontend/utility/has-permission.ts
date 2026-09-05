import { store } from "../app/store/store";


export const hasPermission = (
  requiredPermissions?: string[],
  grantedPermissions?: string[],
): boolean => {
  if (!requiredPermissions?.length) {
    return false;
  }

  const permissions =
    grantedPermissions ?? store.getState().user.permissions;

  return requiredPermissions.some((permission) =>
    permissions.includes(permission),
  );
};