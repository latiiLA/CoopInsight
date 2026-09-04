// utility/jwt.ts
import { jwtDecode } from "jwt-decode";

interface TokenClaims {
  permissions?: string[];
  role?: string;
  userId?: string;
  ip?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  "sub": string; 
}

export const getTokenClaims = (token: string): TokenClaims | null => {
  try {
    return jwtDecode<TokenClaims>(token);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
};