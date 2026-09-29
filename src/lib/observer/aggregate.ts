import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * Given the word selections of each Observer for one Subject, this scores every
 * Observer **individually** with the same normalized scoring core the Self flow
 * uses, then returns the **equal-weight average** of those per-observer profiles
 * — one value per tribe, in canonical (tribe `number`) order.
 *
 * Normalizing each Observer *before* averaging is the whole point (ADR-0003): an
 * Observer who selects more words has already had their raw points normalized to
 * the same 0–1 scale as everyone else, so effort (word count) never becomes
 * influence. This is deliberately **not** a pooled bag of words scored once.
 *
 * Pure and dependency-free apart from the shared scoring core, so it is trivially
 * unit-testable and reused unchanged by the comparison report. It is `server-only`
 * because it pulls in the word→tribe mapping via the scoring core (ADR-0009).
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = observerWordLists.map((words) => score(words));
  const count = perObserver.length;

  return tribes.map((tribe) => {
    let sum = 0;
    for (const scores of perObserver) {
      const tribeScore = scores.find((s) => s.slug === tribe.slug);
      sum += tribeScore ? tribeScore.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });
}
