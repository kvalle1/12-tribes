import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests run in a plain Node environment — the Interview's scoring/flow core
// is pure and its persistence contract is exercised through an in-memory
// repository, so no DOM or live database is needed. `@/` resolves to `src/` to
// match the TypeScript path alias.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
