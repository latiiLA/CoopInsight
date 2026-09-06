const AUTH_STORAGE_KEY = "coop-hub-auth";

type AuthLike = {
  token?: string;
  data?: {
    token?: string;
    refreshToken?: string;
  };
};

export { AUTH_STORAGE_KEY };

export function getTokenFromAuth(auth: unknown): string | undefined {
  if (!auth || typeof auth !== "object") {
    return undefined;
  }

  const value = auth as AuthLike;
  const token = value.data?.token || value.token;

  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export function getRefreshTokenFromAuth(auth: unknown): string | undefined {
  if (!auth || typeof auth !== "object") {
    return undefined;
  }

  const token = (auth as AuthLike).data?.refreshToken;

  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export function withAuthHeader(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function readStoredAuth(): unknown | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const item = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!item) {
      return null;
    }

    return JSON.parse(item);
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getStoredAuthToken(): string | undefined {
  return getTokenFromAuth(readStoredAuth());
}

export function getStoredRefreshToken(): string | undefined {
  return getRefreshTokenFromAuth(readStoredAuth());
}
