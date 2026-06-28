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
  InterviewTurn,
  StrengthProfile,
  StubResult,
} from "@/lib/interview/types";
import type { DerivedResult } from "@/lib/assessment/score";

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
 * Interview Session — server-authoritative state for the AI Agent Interview
 * (PRD #13, slice #14). The client never holds or mutates scoring state
 * (ADR-0009); every Turn is persisted here so a refresh can resume (ADR-0011).
 *
 * `profile` and `result` are placeholders in the walking-skeleton slice; real
 * scoring fills them in later. `userId` is optional so the skeleton works for
 * anonymous sessions (a session is resumed via an opaque cookie id), while
 * leaving the door open to tie a Session to an account.
 */
export const interviewSessions = pgTable("interview_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  status: text("status")
    .$type<"in_progress" | "complete">()
    .notNull()
    .default("in_progress"),
  // Running strength profile (placeholder this slice).
  profile: jsonb("profile").$type<StrengthProfile>().notNull(),
  // Completed Turns, oldest first.
  turns: jsonb("turns").$type<InterviewTurn[]>().notNull().default([]),
  turnCount: integer("turnCount").notNull().default(0),
  // Stub result, set once the flow completes.
  result: jsonb("result").$type<StubResult>(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

/**
 * The Account's single current Self Assessment result (PRD #3, slice #5;
 * ADR-0004: one current result, overwritten on retake — no history).
 *
 * Keyed by `userId` so each account has exactly one row; retaking the
 * assessment upserts it. `words` is the selection the participant submitted
 * (the source of truth — every tribe's score is recomputable from it), and
 * `result` is the derived headline snapshot. `token` is an opaque shareable
 * handle minted once and preserved across retakes; the 360 observer flow
 * (issue #8) hangs anonymous observer responses off it.
 */
export const assessmentResults = pgTable("assessment_result", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // The submitted word selection — the source of truth for (re)scoring.
  words: jsonb("words").$type<string[]>().notNull(),
  // The derived headline result (Primary + optional Secondary).
  result: jsonb("result").$type<DerivedResult>().notNull(),
  // Opaque shareable handle, minted on first save and kept stable on retake.
  token: text("token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
