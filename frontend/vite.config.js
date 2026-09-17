import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/app": path.resolve(__dirname, "./app"),
      "@/utility": path.resolve(__dirname, "./utility"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://localhost:8088",
        changeOrigin: true,
        secure: false,
        ws: true,
        // Oracle clearing reports can take >60s; default proxy idle cut drops the body
        // while Gin still logs 200 — UI then stays stuck in loading.
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
      "/uploads": {
        target: "https://localhost:8088",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});