import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into the "how others see
 * you" profile (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored with the same normalized scoring
 * core the Subject's own profile uses (`score`), then the per-tribe scores are
 * averaged across Observers with **equal weight** — the mean of each Observer's
 * individually-normalized tribe scores, *not* a pooled bag of everyone's words.
 * Because each Observer is normalized before averaging, one Observer who picks
 * more words gains no extra influence (ADR-0003: "effort never becomes
 * influence").
 *
 * `server-only`: this reuses the scoring core, which pulls in the word→tribe
 * mapping that must never reach the client (ADR-0009). Render the report from a
 * server component.
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks. Below it the "others" view is neither statistically meaningful nor
 * safely anonymous, so the report stays locked (ADR-0003).
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * Aggregate a set of Observer responses (each the words that Observer selected)
 * into the equal-weight "others" profile: a normalized 0–1 score for every tribe
 * in canonical (tribe `number`) order. Returns all-zero scores when there are no
 * responses. Unknown/duplicate words are handled by the scoring core.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = responses.map((words) => score(words));

  return tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, scores) => sum + scores[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });
}
