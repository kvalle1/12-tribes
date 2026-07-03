import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure "others" aggregation for the 360 Observer report (issue #9, ADR-0003).
 *
 * The comparison report sets the Subject's own profile beside how a group of
 * anonymous Observers see them. The core decision is that aggregation is
 * **equal-weight**: each Observer is scored individually with the same
 * normalized scoring core the Subject uses, then those per-Observer profiles are
 * averaged one-vote-each. Crucially this is *not* a pooled bag of words — an
 * Observer who selects more words gains no extra influence, so no single voice
 * dominates the "others" view (ADR-0003).
 *
 * Like the scoring core, this module is pure and dependency-free (it only leans
 * on `score`), so it is unit-testable without the DB and reused unchanged
 * wherever the "others" profile is needed. It is `server-only` because `score`
 * pulls in the word→tribe mapping, which must never reach the client.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below this the "others" view is both statistically thin and a
 * potential de-anonymizer of individual Observers, so the report stays locked
 * (ADR-0003). Tunable.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer's word selection individually, returning one normalized
 * `TribeScore[]` per Observer in the order the responses were given. This is the
 * per-Observer drill-down the report renders as "Observer 1 / 2 / 3" — each
 * fully anonymous, carrying only scores and never any attribute of who submitted
 * it. Input order is preserved so the report can label responses stably (the
 * repository returns them oldest-first).
 */
export function scoreEachObserver(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[][] {
  return observerWordLists.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe average of each Observer's
 * individually-normalized score. Every Observer contributes exactly one vote per
 * tribe regardless of how many words they picked, so wordiness never becomes
 * influence (ADR-0003) — the defining contrast with pooling all Observers' words
 * into one selection and scoring that once.
 *
 * Returns a score for every tribe in canonical (tribe `number`) order, matching
 * `score`'s output shape so the report can set self and others side by side. An
 * empty Observer set yields all-zero scores.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(observerWordLists);
  const observerCount = perObserver.length;

  return tribes.map((tribe) => {
    let total = 0;
    for (const observer of perObserver) {
      const tribeScore = observer.find((t) => t.slug === tribe.slug);
      total += tribeScore ? tribeScore.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });
}

/** A tribe compared across the Subject's own profile and the "others" profile. */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /**
   * `self − others`: positive where the Subject rates a tribe higher than others
   * do, negative where others see it more strongly than the Subject does. The
   * magnitude is how far the two views diverge on that tribe.
   */
  divergence: number;
}

/**
 * Pair the Subject's own profile with the "others" profile tribe-by-tribe,
 * computing the signed divergence (`self − others`) so the report can highlight
 * where the two views align and where they pull apart. Matched by slug — the two
 * inputs need not share an order — and returned in the Subject profile's order.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));
  return self.map((tribe) => {
    const othersScore = othersBySlug.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: tribe.score,
      others: othersScore,
      divergence: tribe.score - othersScore,
    };
  });
}
