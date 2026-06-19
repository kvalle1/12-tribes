import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { Turn } from "@/lib/interview/session";

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
 * Interview Session — the server-authoritative state of one Interview run
 * (ADR-0009), persisted every Turn so a refresh or closed tab resumes where the
 * participant left off (ADR-0011). The running `profile` is server-only and is
 * never shipped to the client. Shape mirrors `InterviewSession` in
 * `src/lib/interview/session.ts`; `turns` and `profile` are stored as JSONB.
 */
export const interviewSessions = pgTable(
  "interview_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // "in_progress" | "complete" (see SessionStatus in the domain module).
    status: text("status").notNull().default("in_progress"),
    // Completed Q&A exchanges, in order.
    turns: jsonb("turns").$type<Turn[]>().notNull().default([]),
    // The question awaiting an answer; null when none is pending / complete.
    pendingPrompt: text("pendingPrompt"),
    // Running Strength Profile placeholder (server-only). Empty in this slice.
    profile: jsonb("profile")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("interview_session_userId_idx").on(table.userId)],
);
