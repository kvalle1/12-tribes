import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure aggregation of the anonymous 360 Observer responses into the "how others
 * see you" profile (issue #9, ADR-0003).
 *
 * Each Observer response is scored on its own by the same normalized scoring
 * core the Subject uses (`score`), then the per-tribe scores are averaged with
 * **equal weight** across observers — *not* pooled into one bag of words. This
 * is the whole point of ADR-0003: an Observer who selects more words must not
 * gain more influence, so we normalize each observer first and only then take a
 * plain mean. The result is directly comparable to the Subject's own profile.
 *
 * Reuses the Self scoring core unchanged, so self and observer scores live on
 * the same 0–1 scale. `server-only` because it imports that core (which carries
 * the word→tribe mapping, ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — enough for the average to be meaningful and to keep individual
 * observers anonymous (ADR-0003).
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Score each Observer response independently into a normalized 12-tribe profile
 * (canonical tribe order). Backs the anonymous per-observer drill-down —
 * "Observer 1/2/3" — where each observer's own read is shown without any
 * identifying attributes.
 */
export function scoreObservers(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the mean of each Observer's
 * individually-normalized tribe scores. Returns an all-zero profile (still all
 * 12 tribes, canonical order) when there are no responses.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = scoreObservers(responses);
  const count = profiles.length;

  return tribes.map((tribe) => {
    let total = 0;
    for (const profile of profiles) {
      const entry = profile.find((s) => s.slug === tribe.slug);
      if (entry) total += entry.score;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}
