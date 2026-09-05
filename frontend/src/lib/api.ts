import axios from "axios";

import config from "@/configs/config";
import { getStoredAuthToken } from "../../utility/auth-token";

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

export default api;
