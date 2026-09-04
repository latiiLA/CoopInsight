export type Permission = {
  _id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};
