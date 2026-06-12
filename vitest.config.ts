import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirror the `@/*` path alias from tsconfig so tests can import like app code.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
