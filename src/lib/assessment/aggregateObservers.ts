import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * The 360 "others" aggregation (issue #9, ADR-0003). Pure and dependency-free
 * apart from the shared scoring core, so its behavior can be unit-tested without
 * the DB. `server-only` because it pulls in `score` (and through it the
 * word→tribe mapping), which must never reach the client (ADR-0009).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — one vote per Observer — *not* a
 * pooled bag of every observer's words. Scoring each Observer on their own first
 * (with the same normalized core the Subject uses) and then averaging means a
 * wordier Observer gains no extra influence: whether an Observer picks 8 words
 * or 15, their read counts exactly once (ADR-0003).
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks. Below this the "others" view would be too thin to be meaningful and
 * an individual Observer's anonymity too easily unpicked, so the report stays
 * locked (PRD story 23). Tunable.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer's response independently with the shared normalized core,
 * preserving input order (so a stable, anonymous "Observer 1/2/3" numbering can
 * be derived from a `createdAt`-ordered read). Each element is a full 12-tribe
 * score table in canonical order.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe mean of each Observer's
 * individually-normalized score. Returns a full 12-tribe table in canonical
 * order. With no Observers every tribe is 0 (no divide-by-zero).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(responses);
  const count = perObserver.length;

  return tribes.map((tribe) => {
    const total = perObserver.reduce((sum, observer) => {
      const entry = observer.find((t) => t.slug === tribe.slug);
      return sum + (entry?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}

/**
 * One tribe's self-vs-others comparison. `selfScore` and `othersScore` are the
 * two normalized profiles' values for the tribe; `divergence` is `self − others`
 * — positive where the Subject reads a tribe more strongly than others do,
 * negative where others see it more than the Subject does. `score` mirrors
 * `selfScore` so a `ProfileComparison` is still a usable `TribeScore`.
 */
export interface ProfileComparison extends TribeScore {
  selfScore: number;
  othersScore: number;
  divergence: number;
}

/**
 * Pair a Subject's own profile against the aggregated "others" profile per
 * tribe, in canonical order, computing the self−others divergence for each. Pure
 * and client-safe in itself, though its inputs come from the `server-only`
 * scoring core.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  return tribes.map((tribe) => {
    const selfScore = self.find((t) => t.slug === tribe.slug)?.score ?? 0;
    const othersScore = others.find((t) => t.slug === tribe.slug)?.score ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: selfScore,
      selfScore,
      othersScore,
      divergence: selfScore - othersScore,
    };
  });
}
