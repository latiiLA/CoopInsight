export type Role = {
  id: string;
  name: string;
  permissions: string[];
  status?: string;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};

export function getRoleId(role?: Role | null) {
  return role?.id ?? "";
}

export interface CreateRoleDTO {
  name: string;
  permissions: string[];
}
