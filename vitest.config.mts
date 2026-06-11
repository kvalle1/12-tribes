import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// The current test suite covers the pure TS modules (no DOM/React), so a
// `node` environment is sufficient and fast. `vite-tsconfig-paths` makes the
// `@/*` alias from tsconfig resolve inside tests.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
