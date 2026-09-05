import { Role, getRoleId } from "./role";

export type User = {
  id: string;
  username: string;
  role: Role;
  roleId?: string;
  permissions?: string[];
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  status: string;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateUserDTO {
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: string;
  permissions?: string[];
}

export interface UpdateUserDTO {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: string;
  permissions?: string[];
  status: string;
}

export function getUserId(user?: User | null) {
  return user?.id ?? "";
}

export function getUserRoleId(user?: User | null) {
  if (!user) {
    return "";
  }

  return user.roleId || getRoleId(user.role);
}

export function resolveUserRoleId(user?: User | null, roles: Role[] = []) {
  if (!user) {
    return "";
  }

  const rawId = getUserRoleId(user);

  if (rawId && roles.some((role) => role.id === rawId)) {
    return rawId;
  }

  const byName = roles.find((role) => role.name === user.role?.name);

  if (byName) {
    return byName.id;
  }

  return rawId;
}
