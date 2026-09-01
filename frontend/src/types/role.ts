export type Role = {
  _id: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};
