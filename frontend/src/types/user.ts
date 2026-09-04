import { Role } from "./role";

export type User = {
  id: string;
  username: string;
  role: Role;
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
  role: string;
  permissions?: string[];
}