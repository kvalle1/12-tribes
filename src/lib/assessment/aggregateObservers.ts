import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 observer aggregation (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — not a pooled bag of words. Every
 * Observer is scored on their own via the shared scoring core, so an Observer
 * who selects more words does not gain more influence, and then the per-tribe
 * scores are averaged with equal weight across Observers. This keeps the
 * "others" view a fair aggregate of independent reads rather than one dominated
 * by whoever picked the most words.
 *
 * Pure and dependency-free (beyond the scoring core it reuses), so its external
 * behavior is unit-tested without the DB. It is `server-only` because scoring
 * pulls in the word→tribe mapping, which must never reach the client
 * (ADR-0009 trust boundary); the report renders it on the server and passes only
 * plain per-tribe numbers to the client.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003) — below it the "others" view isn't meaningful and
 * individual Observers wouldn't stay anonymous.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Aggregate Observer word-selections into the equal-weight "others" profile: a
 * normalized 0–1 score for every tribe in canonical (tribe `number`) order.
 *
 * Each entry in `responses` is one Observer's selected words. Each is scored
 * individually and normalized by the scoring core (so unknown words and
 * duplicates are ignored exactly as elsewhere), then the per-tribe scores are
 * averaged with equal weight. With no responses every tribe scores 0.
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
