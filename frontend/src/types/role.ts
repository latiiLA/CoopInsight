export type Role = {
  _id: string;
  name: string;
  permissions: string[];
  status?: string;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};

export interface CreateRoleDTO {
  name: string;
  permissions: string[];
}
