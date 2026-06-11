import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type {
  StrengthProfile,
  Turn,
  SessionStatus,
} from "@/lib/interview/session";

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
 * Interview Session — the server-authoritative state for the AI-agent Interview
 * (ADR-0009), persisted every Turn so a refresh/closed tab resumes mid-flight
 * (ADR-0011). It stores enough to reconstruct a Session: the running profile and
 * posture placeholders, the Turn history, and the answered-turn count — not just
 * a final result. `userId` is nullable: the Interview consumes the broader
 * product's account model rather than defining it (ADR-0011), so a session can
 * exist before/without sign-in and link to a user when one is present.
 */
export const interviewSessions = pgTable("interview_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => users.id, { onDelete: "set null" }),
  status: text("status").$type<SessionStatus>().notNull().default("in_progress"),
  profile: jsonb("profile").$type<StrengthProfile>().notNull(),
  posture: jsonb("posture").$type<StrengthProfile>().notNull(),
  turns: jsonb("turns").$type<Turn[]>().notNull(),
  turnCount: integer("turnCount").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
