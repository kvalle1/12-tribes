import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The assessment scoring core is pure TS — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
