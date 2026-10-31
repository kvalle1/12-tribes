import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults, observerResponses, users } from "@/db/schema";
import { WORDS } from "@/lib/assessment/words";
import { isWithinSelectionRange } from "@/lib/assessment/constants";
import { observerDisplayName } from "./display-name";
import { partitionByRetake } from "./retake";

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
  resolvedSubject?: ObserverSubject | null,
): Promise<boolean> {
  // The caller may pass a Subject it already resolved from this same token
  // (the observer action resolves it to run the anti-self-unlock guard, #193),
  // sparing a second identical lookup; otherwise we resolve it here.
  const subject = resolvedSubject ?? (await getSubjectByToken(token));
  if (!subject) return false;

  const words = [...new Set(selectedWords)].filter((w) => KNOWN_WORDS.has(w));
  if (!isWithinSelectionRange(words.length)) return false;

  await db
    .insert(observerResponses)
    .values({ subjectId: subject.subjectId, words });

  return true;
}

/**
 * Load the anonymous Observer responses recorded for a Subject's *current*
 * result so the equal-weight aggregation (issue #9) can score and average them.
 * Returns only the selected `words` — never any identity.
 *
 * Responses recorded before `resultTakenAt` (the current result's `updatedAt`)
 * describe the Subject against an earlier retake, so they are left out of
 * `current` and only counted in `staleCount` (issue #194, ADR-0012). They stay
 * in the database; nothing is deleted.
 *
 * Ordered by the opaque random `id` (a v4 UUID), not by `createdAt`: that gives
 * a stable order within one render for "Observer 1 … N" drill-down numbering
 * (numbering is not persistent: a new response can reshuffle it), while
 * deliberately *not* following arrival time — so a Subject can't
 * read "Observer 1" as whoever they asked first. Returns an empty `current`
 * when no one has responded since the current result was taken.
 */
export async function getObserverResponses(
  subjectId: string,
  resultTakenAt: Date,
): Promise<{ current: { words: string[] }[]; staleCount: number }> {
  const rows = await db
    .select({
      words: observerResponses.words,
      createdAt: observerResponses.createdAt,
    })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectId))
    .orderBy(asc(observerResponses.id));

  const { current, staleCount } = partitionByRetake(rows, resultTakenAt);
  return { current: current.map(({ words }) => ({ words })), staleCount };
}
