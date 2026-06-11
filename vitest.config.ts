import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the pure TypeScript modules (scoring, flow, validators).
 * These tests need no React/DOM, so the default Node environment is used. The
 * `@` alias mirrors tsconfig so tests import modules the same way app code does.
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
