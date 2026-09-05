export type Permission = {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  status?: string;
  assigned?: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};

export function getPermissionId(permission?: Permission | null) {
  return permission?.id || (permission as { _id?: string } | null | undefined)?._id || "";
}

export interface CreatePermissionDTO {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UpdatePermissionDTO {
  name: string;
  resource: string;
  action: string;
  description?: string;
}
