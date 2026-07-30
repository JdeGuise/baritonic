import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"] },
  resolve: {
    alias: {
      "@baritonic/music-core": fileURLToPath(
        new URL("../music-core/src/index.ts", import.meta.url),
      ),
    },
  },
});
