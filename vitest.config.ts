import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest — the app's first test runner (issue #14). The pure domain modules
 * under `src/lib` are plain TypeScript with no DOM, so the `node` environment is
 * enough. The `@/` alias mirrors tsconfig's `paths` so tests import the same way
 * the app does.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
