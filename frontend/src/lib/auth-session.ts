import axios from "axios";

import config from "@/configs/config";
import { Auth } from "@/types/auth";
import { getStoredRefreshToken } from "../../utility/auth-token";

const AUTH_PATHS = ["/auth/login", "/auth/login-ldap", "/auth/refresh"];

const refreshClient = axios.create({
  baseURL: config.API_URL,
});

let refreshPromise: Promise<string> | null = null;

export function isAuthSessionUrl(url?: string) {
  if (!url) {
    return false;
  }

  return AUTH_PATHS.some((path) => url.includes(path));
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function doRefresh() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await refreshClient.post<Auth>("/auth/refresh", {
    refreshToken,
  });

  const auth = response.data;
  const token = auth?.data?.token;

  if (!token) {
    throw new Error("Refresh did not return a token");
  }

  const { store } = await import("../../app/store/store");
  const { setUser } = await import("@/features/user_slice");
  store.dispatch(setUser(auth));

  return token;
}

export async function endSession() {
  const { store } = await import("../../app/store/store");
  const { logout } = await import("@/features/user_slice");
  store.dispatch(logout());

  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
}
