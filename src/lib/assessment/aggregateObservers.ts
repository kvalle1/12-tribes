import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003).
 *
 * Each Observer response is scored *individually* with the shared normalized
 * scoring core, then the per-tribe scores are averaged with **equal weight** —
 * one vote per Observer, not one vote per word. An Observer who selects more
 * words therefore gains no extra influence: their selection is normalized to a
 * 0–1 profile first, and only then folded into the mean. This is deliberately
 * *not* a pooled "bag of words" (concatenating everyone's selections and
 * scoring once), which would let a wordier Observer dominate.
 *
 * The module reuses `score` unchanged (the same core the Self flow uses), so
 * self and others sit on the same normalized scale and are directly comparable.
 * It is `server-only`: it pulls in the word→tribe mapping via `score`, which
 * must never reach the client (ADR-0009 trust boundary).
 */

/** The report unlocks only once at least this many Observers have responded. */
export const MIN_OBSERVERS = 3;

/** Whether the comparison report is unlocked for the given Observer count. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score every Observer response individually, returning one normalized
 * `TribeScore[]` (all 12 tribes, canonical order) per Observer, in input order.
 * Preserving order lets callers label them anonymously as "Observer 1/2/3"
 * without carrying any identifying attribute.
 */
export function scoreEachObserver(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[][] {
  return observerWordLists.map((words) => score(words));
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile: the mean
 * of each Observer's individually-normalized per-tribe score. Returns all 12
 * tribes in canonical order; an empty set of Observers yields an all-zero
 * profile.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(observerWordLists);
  const count = perObserver.length;

  return tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, observer) => sum + observer[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}

/** A tribe compared across the Subject's own read and the aggregated others. */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The aggregated others' normalized score for this tribe. */
  others: number;
  /** `self − others`: positive where the Subject reads higher than others do. */
  divergence: number;
}

/**
 * Pair a self profile against an others profile tribe-by-tribe, attaching the
 * signed divergence (`self − others`). Rows are sorted by the stronger of the
 * two sides, highest first, so the tribes that matter most to either read
 * surface at the top. Ties keep canonical (tribe `number`) order. Pure — both
 * inputs are already-computed `TribeScore[]`, so this is client-safe.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  return self
    .map((s) => {
      const otherScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others: otherScore,
        divergence: s.score - otherScore,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}
