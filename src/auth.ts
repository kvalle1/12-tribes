import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * - Identity & sessions live in our Postgres via the Drizzle adapter (ADR-0005).
 * - Sign-in is passwordless email magic-link, delivered by Resend.
 * - `session.strategy: "database"` so sessions are server-side rows the adapter
 *   manages (the default once an adapter is present, set explicitly for clarity).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  // Required when self-hosting / deploying behind a proxy (e.g. Vercel) so
  // Auth.js trusts the forwarded host header.
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin?sent=1",
  },
});
