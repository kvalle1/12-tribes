import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirror the `@/*` path alias from tsconfig so tests can import app modules the
// same way the app does. Unit tests are pure (no DOM), so the default node
// environment is used.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
