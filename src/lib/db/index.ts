import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Falls back to a structurally valid placeholder during build-time static
// analysis. No query is ever executed against it — Neon only connects on
// the first actual SQL call, which only happens at request time.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@placeholder.neon.tech/placeholder";

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
