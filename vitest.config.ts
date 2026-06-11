import { defineConfig } from "vitest/config";

/**
 * Vitest is the project's first test runner. The Interview's pure modules
 * (scoring, funnel, stop logic) are plain TypeScript with no DOM, so the
 * default Node environment is all they need. Tests are colocated as
 * `*.test.ts` next to the module they exercise.
 *
 * The `@/` alias mirrors tsconfig's `paths` so tests import modules the same
 * way application code does.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
