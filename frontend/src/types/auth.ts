import { User } from "./user";

export type Auth = {
  message: string;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };
};
