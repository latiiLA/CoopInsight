export type Permission = {
  _id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  status?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};

export interface CreatePermissionDTO {
  name: string;
  resource: string;
  action: string;
  description?: string;
}
