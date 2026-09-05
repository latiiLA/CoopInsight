const AUTH_STORAGE_KEY = "coop-hub-auth";

type AuthLike = {
  token?: string;
  data?: {
    token?: string;
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

export function withAuthHeader(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export function getStoredAuthToken(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const item = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!item) {
      return undefined;
    }

    return getTokenFromAuth(JSON.parse(item));
  } catch {
    return undefined;
  }
}
