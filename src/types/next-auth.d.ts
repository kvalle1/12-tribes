import type { DefaultSession } from "next-auth";

/**
 * Augment the Auth.js `Session` so `session.user.id` is typed.
 *
 * With the database session strategy and the Drizzle adapter, Auth.js already
 * populates the session user from the persisted record (which carries `id`);
 * this declaration just makes that field visible to TypeScript so server code
 * can key the Account's current result off `session.user.id`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
