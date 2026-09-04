import { store } from "../app/store/store";


export const hasPermission = (
  requiredPermissions?: string[],
): boolean => {
  if (!requiredPermissions?.length) {
    return false;
  }

  const permissions = store.getState().user.permissions;

  return requiredPermissions.some((permission) =>
    permissions.includes(permission),
  );
};