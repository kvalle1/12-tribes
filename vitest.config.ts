import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The assessment scoring core is pure TypeScript — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
