import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In dev/preview, /api/* is proxied to the NovaPOS server (npm run server).
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
});
