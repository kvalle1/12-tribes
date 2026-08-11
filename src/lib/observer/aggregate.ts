import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer's words are scored with the *same* normalized scoring core the
 * Self flow uses (`score`), producing a per-Observer Strength Profile (ADR-0002).
 * The "others" profile is then the **equal-weight average** of those per-Observer
 * profiles — averaged *after* each Observer is normalized, so an Observer who
 * selects more words does not gain more influence. This is deliberately not a
 * pooled bag of words: pooling would let word count become influence, which
 * ADR-0003 rejects.
 *
 * Pure and dependency-light so it can be unit-tested directly and reused by the
 * comparison report. The `server-only` import comes in transitively via the
 * scoring core (the word→tribe mapping never reaches the client, ADR-0009).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003): enough for the average to mean something and to keep any
 * single Observer anonymous within the aggregate.
 */
export const MIN_OBSERVERS = 3;

/**
 * Aggregate a set of Observer word selections into one equal-weight "others"
 * Strength Profile. Returns a normalized 0–1 score for every tribe in canonical
 * (tribe `number`) order — the same shape `score` returns — so the result drops
 * straight into ranking and the comparison view. An empty input yields an
 * all-zero profile.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = observerWordLists.map((words) => score(words));
  const n = perObserver.length;

  return tribes.map((tribe) => {
    const sum = perObserver.reduce(
      (acc, scores) =>
        acc + (scores.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: n > 0 ? sum / n : 0,
    };
  });
}
