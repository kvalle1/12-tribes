import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// Neon's HTTP driver: serverless-friendly (no persistent connection), which
// suits Vercel's per-request lifecycle. The Auth.js Drizzle adapter does not
// require transactions, so the HTTP driver is sufficient.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
