import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * The equal-weight "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003). Each Observer describes the Subject by selecting words; this module
 * turns their anonymous responses into a single "others" Strength Profile that
 * sits beside the Subject's own.
 *
 * The defining rule (ADR-0003) is **equal weight**: the "others" profile is the
 * average of each Observer's *individually-normalized* Tribe scores — NOT a
 * pooled bag of every Observer's words scored once. Pooling would let an
 * Observer who selected more words pull the profile toward their read; scoring
 * each Observer on their own first, then averaging, gives every Observer exactly
 * one equal vote regardless of how many words they picked (PRD story 25).
 *
 * It reuses the pure scoring core unchanged (ADR-0001), so an Observer's profile
 * is normalized the same way the Subject's is and the two are directly
 * comparable. Kept `server-only` alongside the scoring core so the word→tribe
 * mapping never reaches the client (ADR-0009).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — so the "others" view is statistically meaningful and no single
 * Observer can be singled out from an aggregate this small (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/** An all-zero profile for every tribe in canonical order. */
function zeroProfile(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Score each Observer's response on its own, returning one normalized profile
 * per Observer in input order. This is the per-Observer view the report's
 * anonymous drill-down (Observer 1/2/3) renders, and the raw material
 * `aggregateObservers` averages. Callers must pass responses in a stable order
 * (e.g. oldest-first) so "Observer N" stays consistent across page loads.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe average of each Observer's
 * individually-normalized score. With no responses, returns an all-zero profile.
 * The result is in canonical (tribe `number`) order and, being an average of
 * 0–1 values, is itself in 0–1 and directly comparable to the Subject's own
 * scored profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const count = responses.length;
  if (count === 0) return zeroProfile();

  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;

  for (const profile of scoreEachObserver(responses)) {
    for (const tribe of profile) totals[tribe.slug] += tribe.score;
  }

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: totals[tribe.slug] / count,
  }));
}

/**
 * One tribe's self-vs-others gap, used to surface where the Subject and their
 * Observers most agree or disagree. `delta` is `self − others`: positive means
 * the Subject rates that tribe higher than others do, negative means others see
 * it more strongly than the Subject does. `magnitude` is `|delta|` for ranking.
 */
export interface ProfileDivergence {
  slug: string;
  name: string;
  self: number;
  others: number;
  delta: number;
  magnitude: number;
}

/**
 * Compare a Subject's own profile against the aggregated "others" profile,
 * tribe by tribe, returning the divergences sorted widest-gap first. Both inputs
 * are expected in canonical order (as `score` and `aggregateObservers` return
 * them); the comparison is by tribe slug, so ordering differences don't matter.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileDivergence[] {
  const othersBySlug = new Map(others.map((tribe) => [tribe.slug, tribe.score]));

  return self
    .map((tribe) => {
      const othersScore = othersBySlug.get(tribe.slug) ?? 0;
      const delta = tribe.score - othersScore;
      return {
        slug: tribe.slug,
        name: tribe.name,
        self: tribe.score,
        others: othersScore,
        delta,
        magnitude: Math.abs(delta),
      };
    })
    .sort((a, b) => b.magnitude - a.magnitude);
}
