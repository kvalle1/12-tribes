import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure TS modules — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
