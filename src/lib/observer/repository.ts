import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults, observerResponses, users } from "@/db/schema";
import { WORDS } from "@/lib/assessment/words";
import { isWithinSelectionRange } from "@/lib/assessment/constants";
import { observerDisplayName } from "./display-name";

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
 * Load every anonymous Observer response for a Subject as bare word lists — the
 * input the equal-weight aggregation (issue #9) consumes. Only `words` is
 * selected: the Observer's identity is never stored.
 *
 * Ordering is by the row's random `id`, not `createdAt`, on purpose. The report
 * labels responses "Observer 1/2/3" positionally; ordering by submission time
 * would make "Observer 1" literally whoever answered first, letting a Subject
 * who knows roughly when each person got the link correlate timing with the
 * anonymous drill-down and deanonymize it. A random-UUID ordering is just as
 * stable across renders but encodes nothing about who answered when (ADR-0003).
 */
export async function getObserverResponses(
  subjectId: string,
): Promise<{ words: string[] }[]> {
  return db
    .select({ words: observerResponses.words })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectId))
    .orderBy(asc(observerResponses.id));
}

/**
 * Count a Subject's anonymous Observer responses without loading their words —
 * enough to drive the "N of 3" unlock progress on the result page without
 * pulling every response's payload (issue #9 unlock gate).
 */
export async function countObserverResponses(
  subjectId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectId));
  return row?.value ?? 0;
}
