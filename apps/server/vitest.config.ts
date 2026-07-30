import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"] },
  resolve: {
    alias: {
      "@music-ui/music-core": pkg("../../packages/music-core/src/index.ts"),
      "@music-ui/ug-import": pkg("../../packages/ug-import/src/index.ts"),
    },
  },
});
