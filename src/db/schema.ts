import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { StrengthProfile, TurnRecord } from "@/lib/interview/skeleton";

/**
 * Auth.js (NextAuth v5) core tables for the Drizzle adapter.
 * Schema mirrors the official Auth.js Postgres/Drizzle schema so the adapter
 * can read and write users, accounts, sessions, and verification tokens.
 * See ADR-0005 (magic-link via Resend) and ADR-0004 (accounts-required).
 */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

/**
 * The Interview's server-authoritative Session (ADR-0009, ADR-0011).
 *
 * Holds everything needed to reconstruct an in-flight Interview after a refresh
 * or closed tab: the running Strength Profile, the Turn history, and the count.
 * Written every Turn so the participant resumes where they left off; the final
 * state is retained for the future report. The Session lives server-side only —
 * the client never receives or mutates these rows (it only carries an opaque
 * session id in a cookie).
 *
 * `userId` ties a Session to an Account when the participant is signed in; it is
 * nullable because the broader account/email model is a dependency this feature
 * consumes rather than defines (ADR-0011).
 */
export const interviewSessions = pgTable("interview_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  status: text("status").$type<"in_progress" | "complete">().notNull().default("in_progress"),
  profile: jsonb("profile").$type<StrengthProfile>().notNull(),
  turns: jsonb("turns").$type<TurnRecord[]>().notNull().default([]),
  turnCount: integer("turnCount").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
