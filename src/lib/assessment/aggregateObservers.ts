import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003).
 *
 * Each Observer's response is scored *individually* through the same normalized
 * scoring core the Subject uses (`score`), yielding one 0–1 Strength Profile per
 * Observer. The "others" profile is then the **equal-weight average** of those
 * per-observer profiles — every Observer contributes exactly `1/N`, so an
 * Observer who picks more words gains no extra influence.
 *
 * This is deliberately *not* a pooled bag of words (summing everyone's raw
 * points and normalizing once), which would let the most prolific Observer
 * dominate. Normalizing per Observer first and then averaging keeps each voice
 * equal regardless of how many words they selected.
 *
 * Pure and dependency-free (beyond the scoring core it reuses) so its behavior
 * is unit-testable without the LLM, the DB, or the request. `server-only`
 * because it transitively pulls in the word→tribe mapping via `score`, which
 * must never reach the client (ADR-0009 trust boundary).
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Below this the "others" view would be too thin to be
 * meaningful and individual Observers would be too easy to single out, so the
 * report stays locked. Tunable.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/**
 * Aggregate a Subject's Observer responses into an equal-weight "others"
 * Strength Profile — a normalized 0–1 score per tribe, in canonical (tribe
 * `number`) order, matching the shape `score` returns so the comparison view can
 * rank it exactly like the Subject's own profile.
 *
 * Each element of `responses` is one Observer's selected words. With no
 * responses the profile is all zeros.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const count = responses.length;

  // Score every Observer individually, keyed by slug so the sum never depends
  // on array ordering.
  const perObserver = responses.map((words) => {
    const byslug = new Map<string, number>();
    for (const s of score(words)) byslug.set(s.slug, s.score);
    return byslug;
  });

  return tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, observer) => sum + (observer.get(tribe.slug) ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}
