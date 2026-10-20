import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: import.meta.dirname,
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  server: {
    allowedHosts: [".ngrok.app", ".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest) => {
            proxyRequest.setHeader("origin", "http://localhost:5173");
          });
        },
      },
    },
  },
  build: { outDir: path.resolve(import.meta.dirname, "dist"), emptyOutDir: true },
});
