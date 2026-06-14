import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The Marker Catalog is a server-only module (`import "server-only"`). In the
// real app that directive throws if the module is pulled into a client bundle.
// Under Vitest there is no client/server boundary, so we alias `server-only`
// to its bundled no-op (`empty.js`) — the same target Next resolves on the
// server via the `react-server` export condition — letting the tests import the
// catalog without tripping the guard.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
