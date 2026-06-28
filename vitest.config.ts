import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the pure TypeScript modules (scoring, flow, validators).
 * These tests need no React/DOM, so the default Node environment is used. The
 * `@` alias mirrors tsconfig so tests import modules the same way app code does.
 *
 * The `server-only` marker package (which guards server-only modules so a
 * client import is a build error) throws when imported under Node's default
 * condition, so we alias it to an empty stub for tests only. Production builds
 * still resolve the real package and keep enforcing the trust boundary.
 */
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
