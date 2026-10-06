import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 observer aggregation (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * observer's *individually normalized* tribe scores — not a pooled bag of words.
 * Each observer's selection is scored through the same pure core the Subject's
 * Self Assessment uses (`score`), which already normalizes per tribe, so one
 * observer who picks more words does not gain more influence: every observer
 * contributes exactly one normalized profile to the average (effort is never
 * influence, ADR-0003).
 *
 * This module is `server-only` because it pulls in the scoring core and its
 * word→tribe mapping; the aggregated profile is rendered from a server
 * component, never shipped to the client (ADR-0009). It is otherwise pure and
 * DB-free, so its behavior is unit-tested directly.
 */

/**
 * The comparison report unlocks only once at least this many observers have
 * responded (ADR-0003) — enough for the average to mean something and to keep
 * any single observer un-identifiable.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough observers have responded to unlock the comparison report. */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS_TO_UNLOCK;
}

export interface ObserverAggregate {
  /** How many observer responses went into the average. */
  observerCount: number;
  /**
   * Equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the "others" profile.
   */
  others: TribeScore[];
  /**
   * Each observer's own normalized profile, in input order. Anonymous: an
   * observer is only ever its position here (Observer 1, 2, 3…), never an
   * identity (ADR-0003).
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's observer responses into the equal-weight "others"
 * profile. Each `responses` entry is one observer's selected words; it is scored
 * individually and the per-tribe scores are averaged with equal weight. With no
 * responses the average is an all-zero profile (and the report stays locked).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, profile) =>
        sum + (profile.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { observerCount: perObserver.length, others, perObserver };
}

/**
 * A single tribe in the self-vs-others comparison. `selfRelative` and
 * `othersRelative` are both scaled against the *same* max (the largest score in
 * either profile), so the two bars are directly comparable in the report rather
 * than each normalized to its own top. `divergence` is `others − self`:
 * positive where others see a tribe more strongly than the Subject does,
 * negative where the Subject rates it above how others read them.
 */
export interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  selfRelative: number;
  othersRelative: number;
  divergence: number;
}

/**
 * A divergence (|others − self|) at or above this fraction of the shared max is
 * notable enough to flag in the report — the gaps worth a second look. Below it,
 * the two reads count as broadly aligned.
 */
export const DIVERGENCE_HIGHLIGHT = 0.15;

/**
 * Pair the Subject's own profile with the aggregated "others" profile for the
 * side-by-side report. Both arrays are canonical-order tribe scores (as returned
 * by `score`/`aggregateObservers`); rows are matched by slug, scaled to a shared
 * max, and ordered by prominence (the greater of the two scores) so the tribes
 * that matter to either read rise to the top. Ties keep canonical order (the
 * stable sort preserves the input's order). Pure — no mutation of the inputs.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: ComparisonRow[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      selfRelative: max > 0 ? s.score / max : 0,
      othersRelative: max > 0 ? othersScore / max : 0,
      divergence: othersScore - s.score,
    };
  });

  return rows.sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
}
