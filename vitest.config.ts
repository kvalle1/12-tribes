import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Colocated unit tests for the pure modules (no DOM/React needed).
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
