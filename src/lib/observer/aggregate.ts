import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's *individually-normalized* tribe scores — **not** a pooled bag of
 * words. Scoring each Observer first (via the shared Self scoring core, so the
 * two sides stay comparable) and then averaging means an Observer who selects
 * more words never gains more influence than one who selects fewer: every
 * Observer contributes exactly one normalized profile, weighted equally.
 *
 * `server-only` because it pulls in the `server-only` scoring core (and through
 * it the word→tribe mapping), which must never reach the client (ADR-0009).
 */

/**
 * Score each Observer's selection individually, returning one normalized
 * `TribeScore[]` (canonical tribe order) per response, in the input order — so
 * index 0 is "Observer 1" for the anonymous drill-down. Unknown/duplicate words
 * are handled by the scoring core.
 */
export function scoreObservers(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe average of the Observers'
 * individually-normalized scores, in canonical (tribe `number`) order. Returns
 * an all-zero profile when there are no responses, so callers never divide by
 * zero. Matching is by slug so the result never depends on score array ordering.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = scoreObservers(responses);
  const n = profiles.length;

  return tribes.map((tribe) => {
    const sum = profiles.reduce(
      (acc, profile) =>
        acc + (profile.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: n > 0 ? sum / n : 0,
    };
  });
}
