import axios, { type InternalAxiosRequestConfig } from "axios";

import config from "@/configs/config";
import { getStoredAuthToken } from "../../utility/auth-token";
import {
  endSession,
  isAuthSessionUrl,
  refreshAccessToken,
} from "@/lib/auth-session";

const api = axios.create({
  baseURL: config.API_URL,
});

api.interceptors.request.use((request) => {
  const token = getStoredAuthToken();

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthSessionUrl(original.url)
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      await endSession();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
