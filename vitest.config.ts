import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Match the tsconfig "@/*" -> "./src/*" path mapping.
      "@": resolve(__dirname, "src"),
      // server-only throws when imported outside the React Server condition.
      // Under test we resolve it to its no-op entry so server-only modules
      // (e.g. the Marker Catalog) can be exercised by Vitest. The build-time
      // client-bundle protection is unaffected.
      "server-only": resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
