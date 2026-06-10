import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
// Relative (not the `@/` alias) so drizzle-kit's schema loader resolves it.
// Type-only import — erased at runtime, so no scoring/interview code is pulled
// into the migration toolchain.
import type { InterviewStatus, InterviewTurn } from "../lib/interview/session";

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
 * Interview Session — the server-authoritative, resumable state of one
 * Interview (ADR-0009, ADR-0011). Written every Turn so a refresh or closed tab
 * resumes where the participant left off. `profile` is a placeholder in the
 * walking skeleton (no scoring yet); the later slices grow it. The client never
 * holds or mutates any of this.
 */
export const interviewSessions = pgTable("interview_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Ties the Session to the account model when present (ADR-0011). Nullable in
  // the skeleton so the flow is demonstrable before auth-gating is wired.
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  // Running Strength Profile — empty placeholder until the scoring slices land.
  profile: jsonb("profile")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  // Per-Turn history, enough to reconstruct the Session mid-flight.
  turns: jsonb("turns").$type<InterviewTurn[]>().notNull().default([]),
  turnCount: integer("turnCount").notNull().default(0),
  status: text("status")
    .$type<InterviewStatus>()
    .notNull()
    .default("in_progress"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
