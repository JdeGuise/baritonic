import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Requires Vite 6+. Node lists `node:sqlite` in builtinModules ONLY with
  // the prefix, unlike every other builtin; Vite 5 stripped the prefix
  // before checking that list, so it tried to resolve a package named
  // "sqlite" and failed. Do not downgrade Vite here.
  test: { globals: true, include: ["test/**/*.test.ts"] },
  resolve: {
    alias: {
      "@baritonic/music-core": pkg("../../packages/music-core/src/index.ts"),
      "@baritonic/ug-import": pkg("../../packages/ug-import/src/index.ts"),
    },
  },
});
