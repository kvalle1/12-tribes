import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses into the "how others
 * see you" profile (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored individually with the same pure
 * scoring core the Self flow uses, producing a normalized 0–1 profile per
 * Observer. The "others" profile is the **equal-weight average** of those
 * per-Observer profiles — NOT a single score over a pooled bag of every
 * Observer's words. Averaging normalized profiles means an Observer who selects
 * more words does not gain more influence: effort (word count) never becomes
 * weight, so no single voice dominates the aggregate.
 *
 * Like `score`, this imports the word→tribe mapping and is therefore
 * `server-only`; the aggregate is computed on the server and only the resulting
 * scores are handed to the client.
 */

const CANONICAL_ORDER = tribes.map((t) => t.slug);

/**
 * Aggregate anonymous Observer responses (each a list of selected words) into a
 * single normalized "others" profile — one score per tribe, in canonical
 * (tribe `number`) order. With no responses every tribe scores 0, so callers can
 * render a report shell without special-casing the empty case.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = responses.map(
    (words) => new Map(score(words).map((s) => [s.slug, s.score])),
  );
  const observerCount = perObserver.length;

  return tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + (profile.get(tribe.slug) ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });
}

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below it the average would be too thin to be meaningful
 * and an individual Observer's read could be inferred — so the report stays
 * locked, protecting both signal quality and Observer anonymity.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isObserverReportUnlocked(responseCount: number): boolean {
  return responseCount >= MIN_OBSERVERS;
}

/** Exported for callers that want to iterate tribes in the aggregate's order. */
export { CANONICAL_ORDER };
