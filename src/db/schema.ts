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

/**
 * A single anonymous 360 Observer response (issue #8, ADR-0003). One Subject has
 * many responses. Deliberately carries **no** observer identity — no name, no
 * relationship label, nothing linking a row back to who submitted it — so an
 * Observer can answer candidly. `subjectId` is the Subject's user id, resolved
 * from the opaque `shareToken` on their `assessmentResults` row; the Observer
 * never authenticates. `words` are the selected words, gated to the same 8–15
 * range as the Self Assessment so observer and self scores stay comparable. The
 * equal-weight "others" aggregation that consumes these rows is issue #9.
 */
export const observerResponses = pgTable("observer_response", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  subjectId: text("subjectId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  words: jsonb("words").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
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
  // Running strength profile, updated each Turn from cited-Marker deltas (#16).
  profile: jsonb("profile").$type<StrengthProfile>().notNull(),
  // Completed Turns (each carrying its score trace), oldest first.
  turns: jsonb("turns").$type<InterviewTurn[]>().notNull().default([]),
  turnCount: integer("turnCount").notNull().default(0),
  // The question currently being asked. The opener is fixed; later questions are
  // produced by the agent alongside each answer's score (ADR-0009), so the
  // current question is persisted rather than derived from a static list (#16).
  currentQuestion: text("currentQuestion"),
  // Stub result, set once the flow completes.
  result: jsonb("result").$type<StubResult>(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
