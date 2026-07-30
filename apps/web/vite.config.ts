import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@baritonic/music-core": fileURLToPath(
        new URL("../../packages/music-core/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    // The API runs separately in development; in production one process
    // serves both from the same origin, so requests stay relative.
    proxy: { "/api": "http://127.0.0.1:4173" },
  },
});
