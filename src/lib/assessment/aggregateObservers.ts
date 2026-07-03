import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * The 360 "others" aggregation (issue #9, ADR-0003). Turns a Subject's anonymous
 * Observer responses into a single per-tribe "others" profile that can be shown
 * beside the Subject's own Self Assessment profile.
 *
 * The rule is **equal weight per Observer**: each Observer's word selection is
 * scored on its own with the shared normalized scoring core, and the "others"
 * profile is the plain average of those per-Observer profiles — one vote each.
 * It is deliberately NOT a pooled bag of words (concatenating everyone's picks
 * and scoring once), because pooling lets a wordier Observer, or a word several
 * Observers happen to share, pull the result. Averaging per-Observer profiles
 * keeps every Observer's influence equal regardless of how many words they
 * picked.
 *
 * Pure and `server-only` for the same reason `score` is: it reaches the
 * word→tribe mapping, which must never reach the client (ADR-0009).
 */

/**
 * The report unlocks only once at least this many Observers have responded. Below
 * it the "others" view would be too thin to be meaningful and could de-anonymize
 * an individual Observer, so the comparison stays locked (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer response individually with the shared normalized core,
 * preserving input order. Each element is a full 12-tribe profile in canonical
 * (tribe `number`) order — the anonymous per-Observer profiles the drill-down
 * renders as "Observer 1", "Observer 2", … .
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the average, per tribe, of the individually
 * scored Observer profiles. Returns a full 12-tribe profile in canonical order
 * (all zeros when there are no responses), matching the shape `score` returns so
 * the two profiles can be compared and ranked with the same helpers.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(responses);
  const n = perObserver.length;

  const totals = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const profile of perObserver) {
    for (const tribe of profile) {
      totals.set(tribe.slug, (totals.get(tribe.slug) ?? 0) + tribe.score);
    }
  }

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: n > 0 ? (totals.get(tribe.slug) ?? 0) / n : 0,
  }));
}

/** A tribe's Self score set beside the aggregated "others" score, with the gap. */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" score for this tribe. */
  others: number;
  /** `self - others`: positive where the Subject reads higher than others do. */
  divergence: number;
}

/**
 * Pair a Self profile with an "others" profile tribe-by-tribe, keeping the Self
 * profile's (canonical) order and carrying the signed `divergence` so the report
 * can surface where the Subject and their Observers most agree and diverge. Any
 * tribe missing from `others` is treated as 0.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  return self.map((s) => {
    const other = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: other,
      divergence: s.score - other,
    };
  });
}
