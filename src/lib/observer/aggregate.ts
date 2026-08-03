import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * The equal-weight "others" aggregation that closes the 360 loop (issue #9,
 * ADR-0003). Each Observer's words are scored **individually** by the same
 * normalized scoring core the Self flow uses (`score`), producing a per-Observer
 * 0–1 tribe vector; the "others" profile is the **equal-weight average** of those
 * vectors — one Observer counts as one Observer, so someone who selects more
 * words does not gain more influence. This is deliberately *not* a pooled bag of
 * words (which would let a 15-word Observer outvote an 8-word one).
 *
 * Server-only because it reaches the `server-only` scoring core (and through it
 * the word→tribe mapping, ADR-0009). It is otherwise pure — no I/O, no clock — so
 * it is unit-testable in isolation.
 */

/**
 * How many Observers must respond before the comparison report unlocks
 * (ADR-0003). Below this the average isn't meaningful and, with too few
 * responses, individual anonymity is weaker — so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * Score each Observer's words individually into a normalized 12-tribe vector (in
 * canonical tribe order). Backs both the aggregate and the anonymous per-Observer
 * drill-down, so each Observer is scored exactly once and identically.
 */
export function scoreObservers(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight average of each Observer's individually-normalized tribe
 * scores — the "how others see you" profile. Returns a `TribeScore` for every
 * tribe in canonical order, on the same normalized 0–1 scale as the Self profile
 * so the two are directly comparable. An empty set of responses yields an
 * all-zero profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreObservers(responses);
  const observerCount = perObserver.length;

  return tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, vector) =>
        sum + (vector.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });
}
