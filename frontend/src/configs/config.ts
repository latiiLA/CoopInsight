const apiUrl = import.meta.env.VITE_API_URL;
const loginType = import.meta.env.VITE_LOGIN_TYPE;

if (!apiUrl) {
  throw new Error("❌ VITE_API_URL is not defined in your environment variables!");
}

if (!loginType) {
  throw new Error("❌ VITE_LOGIN_TYPE is not defined in your environment variables!");
}

const liveMonitoringEnabled =
  String(import.meta.env.VITE_LIVE_MONITORING_ENABLED || "")
    .trim()
    .toLowerCase() === "true";

const config = {
  API_URL: apiUrl,
  Login_Type: loginType,
  LiveMonitoringEnabled: liveMonitoringEnabled,
};

export default config;
