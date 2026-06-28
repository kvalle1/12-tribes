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
  InterviewResult,
  InterviewTurn,
  ScoreTraceEntry,
  StrengthProfile,
} from "@/lib/interview/types";

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
 * (PRD #13). The client never holds or mutates scoring state (ADR-0009); every
 * Turn is persisted here so a refresh can resume (ADR-0011).
 *
 * As of slice #16 `profile` is the real running Strength Profile, `trace` is the
 * per-Marker score trace, `pendingQuestion` is the LLM-produced question
 * awaiting an answer (persisted so a refresh resumes on the same question), and
 * `result` is the computed Interview result set on completion. `userId` is
 * optional so a Session can be anonymous (resumed via an opaque cookie id) while
 * leaving the door open to tie it to an account.
 */
/**
 * The Account's single current Self Assessment result (ADR-0004). One row per
 * user — `userId` is the primary key, so retaking the assessment overwrites the
 * previous result rather than accumulating history.
 *
 * Stores the Subject's selected `words` plus the computed result (the Primary
 * and optional Secondary tribe slugs). The full 12-tribe ranking shown on the
 * result page (issue #6) is recomputed from `words` by the pure scoring core, so
 * `words` stays the source of truth and the derived ranking can never drift from
 * it. `shareToken` is an opaque, unguessable id minted with the result; it backs
 * the 360 observer link built in issue #8.
 */
export const assessmentResults = pgTable("assessment_result", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // The words the Subject selected, in selection order.
  words: jsonb("words").$type<string[]>().notNull(),
  // Computed headline result (slugs into `tribes`).
  primarySlug: text("primarySlug").notNull(),
  secondarySlug: text("secondarySlug"),
  // Opaque shareable token backing the future 360 observer link (issue #8).
  shareToken: text("shareToken")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const interviewSessions = pgTable("interview_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  status: text("status")
    .$type<"in_progress" | "complete">()
    .notNull()
    .default("in_progress"),
  // Running Strength Profile, keyed by tribe slug.
  profile: jsonb("profile").$type<StrengthProfile>().notNull(),
  // Completed Turns, oldest first.
  turns: jsonb("turns").$type<InterviewTurn[]>().notNull().default([]),
  turnCount: integer("turnCount").notNull().default(0),
  // Per-Marker score trace (answer → Marker → contribution), oldest first.
  trace: jsonb("trace").$type<ScoreTraceEntry[]>().notNull().default([]),
  // The LLM-produced question awaiting an answer; null once complete.
  pendingQuestion: text("pendingQuestion"),
  // Computed Interview result, set once the flow completes.
  result: jsonb("result").$type<InterviewResult>(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
