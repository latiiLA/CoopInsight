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
        target: "https://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/uploads": {
        target: "https://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});