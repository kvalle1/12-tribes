import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — one vote per Observer — *not* a
 * pooled bag of everyone's words. Scoring each Observer on their own first
 * (with the same normalized core the Self flow uses) means an Observer who
 * happens to pick more words gains no extra influence: their profile is already
 * on a 0–1 scale before it is averaged in. Pooling, by contrast, would let a
 * wordy Observer swamp the result.
 *
 * Pure and dependency-light so the same math backs the comparison report and
 * its per-observer drill-down. `server-only` because it reaches the scoring
 * core, which carries the word→tribe mapping that must never reach the client
 * (ADR-0009 trust boundary).
 */

/**
 * How many Observer responses must exist before the comparison report unlocks
 * (ADR-0003). Below this the "others" view would be too thin to be meaningful
 * and individual Observers would be too easy to single out. Tunable.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer response individually, preserving input order so callers
 * can attach stable, anonymous "Observer 1 / 2 / 3" labels for the report's
 * drill-down. Each entry is a full 12-tribe normalized profile.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe mean of every Observer's
 * individually-normalized score. Returns a 0 profile for every tribe (in
 * canonical order) when there are no responses, so callers never special-case
 * an empty set.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(responses);
  const observerCount = perObserver.length;

  return tribes.map((tribe) => {
    let sum = 0;
    for (const profile of perObserver) {
      const entry = profile.find((s) => s.slug === tribe.slug);
      sum += entry ? entry.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });
}

/** A self-vs-others comparison for one tribe. */
export interface ProfileComparison extends TribeScore {
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" score for this tribe. */
  others: number;
  /** `self − others`: positive where the Subject reads higher than others do. */
  divergence: number;
}

/**
 * Pair a Subject's own profile against the aggregated "others" profile,
 * tribe-by-tribe in canonical order, exposing the signed divergence the report
 * highlights. `score` carries the Subject's own value so the row still satisfies
 * `TribeScore` for shared rendering helpers.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  return tribes.map((tribe) => {
    const selfScore = self.find((s) => s.slug === tribe.slug)?.score ?? 0;
    const othersScore = others.find((s) => s.slug === tribe.slug)?.score ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: selfScore,
      self: selfScore,
      others: othersScore,
      divergence: selfScore - othersScore,
    };
  });
}
