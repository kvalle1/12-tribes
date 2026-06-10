import { defineConfig } from "vitest/config";

// Unit tests cover the pure modules only (state machines, scoring, validators) —
// not UI, auth, or persistence, which are verified via `npm run build` and by
// running the app. Tests are colocated as `*.test.ts` next to the module.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
