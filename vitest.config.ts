import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` path alias so tests import like app code.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
