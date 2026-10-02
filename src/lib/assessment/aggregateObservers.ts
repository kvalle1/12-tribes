import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003).
 *
 * Each Observer response is scored *individually* with the shared, normalized
 * scoring core (`score`), then the per-tribe "others" profile is the
 * **equal-weight average** of those per-observer profiles — one vote per
 * Observer. This is deliberately *not* a pooled bag of everyone's words: pooling
 * would let an Observer who selects more words exert more influence, which
 * ADR-0003 forbids. Averaging normalized profiles keeps every Observer's pull
 * identical regardless of how many words they picked.
 *
 * The module is pure and dependency-free (it only reaches for the scoring core
 * and the tribe list), so its behavior is fully unit-testable without a DB. It
 * is `server-only` because `score` pulls in the word→tribe mapping, which must
 * never reach the client (ADR-0009 trust boundary).
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below this the "others" signal is too thin to be meaningful (and too
 * easy to de-anonymize), so the report stays locked (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer's word selection independently, in the order given
 * (callers pass responses oldest-first so the resulting profiles line up with
 * stable, anonymous "Observer N" labels). Each entry is a full 12-tribe score
 * table in canonical tribe order. The input is not mutated.
 */
export function scoreEachObserver(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[][] {
  return observerWordLists.map((words) => score(words));
}

/**
 * The equal-weight average "others" profile across all Observer responses: for
 * each tribe, the mean of that tribe's normalized score over the per-observer
 * profiles. Returns a full 12-tribe table in canonical order; an empty input
 * yields an all-zero profile (no Observers ⇒ no signal).
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(observerWordLists);
  const count = perObserver.length;

  return tribes.map((tribe) => {
    let sum = 0;
    for (const profile of perObserver) {
      const match = profile.find((s) => s.slug === tribe.slug);
      if (match) sum += match.score;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });
}

/** A single tribe's self-vs-others comparison, with the signed gap between them. */
export interface TribeDivergence {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /**
   * `self - others`: positive where the Subject rates themselves higher than
   * others do (a blind spot / self-view lead), negative where others see more of
   * this tribe than the Subject claims.
   */
  delta: number;
}

/**
 * Pair a self profile against an aggregated "others" profile tribe-by-tribe,
 * returning the signed divergence for each. Both inputs come from the same
 * normalized core, so `self` and `others` are directly comparable. Aligned by
 * slug (not position) so a caller can pass profiles in any order; the output is
 * in canonical tribe order. Pure.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): TribeDivergence[] {
  const selfBySlug = new Map(self.map((s) => [s.slug, s]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s]));

  return tribes.map((tribe) => {
    const selfScore = selfBySlug.get(tribe.slug)?.score ?? 0;
    const othersScore = othersBySlug.get(tribe.slug)?.score ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: selfScore,
      others: othersScore,
      delta: selfScore - othersScore,
    };
  });
}
