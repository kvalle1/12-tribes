import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Reuses the pure Self scoring core unchanged so an Observer's read
 * is scored exactly like a Subject's self-read, keeping the two comparable.
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's *individually-normalized* tribe scores — not a pooled bag of all
 * observers' words. Normalizing per Observer first, then averaging, means one
 * Observer who selects more words does not gain more influence: every Observer
 * contributes one full profile weighted the same (PRD story 25).
 *
 * `server-only` because it depends on the `score` core, which carries the
 * word→tribe mapping that must never reach the client (ADR-0009 trust boundary).
 */

/** An Observer response reduced to the words selected — the only thing stored. */
export type ObserverWords = readonly string[];

/**
 * Score each Observer response independently, returning one normalized
 * 12-tribe profile per Observer, in input order. This is the per-observer
 * drill-down data (Observer 1/2/3), each fully anonymous — just a profile, no
 * identity — and the building block `aggregateObservers` averages over.
 */
export function scoreEachObserver(
  responses: readonly ObserverWords[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile from already-scored per-Observer profiles:
 * the per-tribe average across profiles, for all 12 tribes in canonical (tribe
 * `number`) order. With no profiles every tribe is 0 (the report stays locked
 * below the ≥3 threshold anyway; see `constants.ts`).
 *
 * Kept separate from `aggregateObservers` so a caller that already needs the
 * per-Observer profiles (e.g. the report's drill-down) can score each Observer
 * once and reuse the result here, rather than scoring every response twice.
 */
export function aggregateProfiles(
  profiles: readonly TribeScore[][],
): TribeScore[] {
  const count = profiles.length;

  return tribes.map((tribe) => {
    const total = profiles.reduce((sum, profile) => {
      const entry = profile.find((s) => s.slug === tribe.slug);
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
 * The equal-weight "others" profile straight from raw Observer responses: scores
 * each Observer individually, then averages (see `aggregateProfiles`).
 */
export function aggregateObservers(
  responses: readonly ObserverWords[],
): TribeScore[] {
  return aggregateProfiles(scoreEachObserver(responses));
}
