import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults, observerResponses, users } from "@/db/schema";
import { WORDS } from "@/lib/assessment/words";
import { isWithinSelectionRange } from "@/lib/assessment/constants";
import { observerDisplayName } from "./display-name";
import type { ObserverResponseInput } from "@/lib/assessment/aggregate-observers";

/**
 * Server-only persistence for the 360 Observer flow (issue #8, ADR-0003). The
 * `server-only` import keeps the word→tribe mapping (pulled in via `WORDS`) and
 * the subject lookup off the client. Observer rows are anonymous; nothing here
 * records or returns who an Observer is.
 */

const KNOWN_WORDS = new Set(WORDS.map((w) => w.word));

export interface ObserverSubject {
  /** The Subject's user id — the `subjectId` an observer response is tied to. */
  subjectId: string;
  /** A display name for the observer prompt (never the Observer's identity). */
  subjectName: string;
}

/**
 * Resolve a shareable observer token to the Subject it belongs to, or `null` if
 * the token is unknown. The token is the opaque `shareToken` minted with the
 * Subject's current result (#5); an unguessable, unknown, or stale token simply
 * returns `null` so the observer page can render a graceful "link not found".
 */
export async function getSubjectByToken(
  token: string,
): Promise<ObserverSubject | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      subjectId: assessmentResults.userId,
      name: users.name,
      email: users.email,
    })
    .from(assessmentResults)
    .innerJoin(users, eq(users.id, assessmentResults.userId))
    .where(eq(assessmentResults.shareToken, token))
    .limit(1);

  if (!row) return null;

  return {
    subjectId: row.subjectId,
    subjectName: observerDisplayName(row.name, row.email),
  };
}

/**
 * Record an Observer's selected words against the Subject named by `token`.
 * Unknown words are dropped and duplicates collapsed before the count is gated
 * to the 8–15 range (the same gate the Subject's submission uses, re-checked
 * here so an out-of-range or tampered submission can't slip past). Returns
 * `false` — recording nothing — when the token is unknown or the selection is
 * out of range; `true` once the anonymous row is written.
 */
export async function recordObserverResponse(
  token: string,
  selectedWords: readonly string[],
): Promise<boolean> {
  const subject = await getSubjectByToken(token);
  if (!subject) return false;

  const words = [...new Set(selectedWords)].filter((w) => KNOWN_WORDS.has(w));
  if (!isWithinSelectionRange(words.length)) return false;

  await db
    .insert(observerResponses)
    .values({ subjectId: subject.subjectId, words });

  return true;
}

/**
 * Load every Observer response for a Subject, oldest first, as the anonymous
 * `{ words }` inputs the equal-weight aggregation (issue #9) consumes. Only the
 * selected words are returned — never the row id, timestamp, or anything that
 * could identify who answered (ADR-0003). The stable oldest-first order is what
 * lets the comparison report label them "Observer 1", "Observer 2", … the same
 * way on every load. `id` breaks ties on `createdAt` so the order is fully
 * deterministic even when two rows share a timestamp (a seed script or
 * near-simultaneous submissions), keeping the labels stable across loads.
 */
export async function getObserverResponses(
  subjectId: string,
): Promise<ObserverResponseInput[]> {
  const rows = await db
    .select({ words: observerResponses.words })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectId))
    .orderBy(asc(observerResponses.createdAt), asc(observerResponses.id));

  return rows.map((row) => ({ words: row.words }));
}

/**
 * Count a Subject's Observer responses without loading them — for the ≥3 unlock
 * gate on the result page, which only needs the number, not the words. Avoids
 * pulling every response's `words` array into memory just to take a length.
 */
export async function getObserverCount(subjectId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectId));

  return row?.value ?? 0;
}
