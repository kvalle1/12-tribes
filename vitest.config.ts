import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure TypeScript modules under unit test run in a Node environment. The
// `server-only` marker package (which guards server-only modules so a client
// import is a build error) throws when imported under Node's default
// condition, so we alias it to an empty stub for tests only. Production builds
// still resolve the real package and keep enforcing the trust boundary.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
