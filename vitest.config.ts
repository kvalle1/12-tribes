import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests are colocated as `*.test.ts` next to the modules they exercise.
// The `@/` alias mirrors tsconfig's path mapping so test imports match app code.
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
