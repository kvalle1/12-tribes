import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Only run our colocated unit tests; exclude Next build output and deps.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
