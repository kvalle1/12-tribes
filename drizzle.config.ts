import { defineConfig } from "drizzle-kit";

// drizzle-kit auto-loads `.env`, so DATABASE_URL is available here for the
// `migrate` / `push` / `studio` commands. `generate` reads only the schema.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
