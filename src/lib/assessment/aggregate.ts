import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer is scored **individually** with the same normalized scoring core
 * as the Self Assessment (`score`), then the per-Observer profiles are averaged
 * with equal weight. Averaging individually-normalized profiles — rather than
 * pooling everyone's words into one big selection — is the whole point: an
 * Observer who happens to pick more words does not gain more influence, because
 * their words are normalized to a 0–1 profile before they enter the average
 * (ADR-0003). The output shape matches `score()` exactly (a normalized 0–1 value
 * per tribe, in canonical `number` order) so the comparison report can rank and
 * render it with the same machinery the Self profile uses.
 *
 * This module is `server-only` because it pulls in the word→tribe mapping via
 * `score`; the aggregation runs server-side, same as scoring (ADR-0009).
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Below this floor the average isn't meaningful and, just as
 * importantly, individual anonymity is weaker — so the report stays locked and
 * only the progress toward the floor is shown.
 */
export const MIN_OBSERVERS = 3;

/**
 * Score each Observer's selection individually, returning one normalized profile
 * per Observer (in the input's order). This is the per-Observer view the
 * comparison report's anonymous "Observer 1 / 2 / 3" drill-down renders, and the
 * raw material `aggregateObservers` averages.
 */
export function scoreObserverSelections(
  selections: readonly (readonly string[])[],
): TribeScore[][] {
  return selections.map((words) => score(words));
}

/**
 * Average a set of already-scored tribe profiles with equal weight, returning a
 * normalized profile in canonical tribe order. Pure (no scoring, no
 * `server-only` need of its own): it joins by slug so it doesn't depend on the
 * input profiles' ordering, and returns an all-zero canonical profile for an
 * empty set. Exposed alongside `aggregateObservers` so it can be unit-tested
 * directly and reused if pre-scored profiles are ever averaged.
 */
export function averageProfiles(
  profiles: readonly (readonly TribeScore[])[],
): TribeScore[] {
  const sums = new Map<string, number>();
  for (const tribe of tribes) sums.set(tribe.slug, 0);

  for (const profile of profiles) {
    for (const s of profile) {
      sums.set(s.slug, (sums.get(s.slug) ?? 0) + s.score);
    }
  }

  const divisor = profiles.length || 1;
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: (sums.get(tribe.slug) ?? 0) / divisor,
  }));
}

/**
 * The equal-weight "others" profile for a Subject: score each Observer response
 * individually and return the equal-weight average per tribe. An empty set of
 * responses yields an all-zero canonical profile.
 */
export function aggregateObservers(
  selections: readonly (readonly string[])[],
): TribeScore[] {
  return averageProfiles(scoreObserverSelections(selections));
}
