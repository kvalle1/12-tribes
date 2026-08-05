import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (ADR-0003, issue #9).
 *
 * Each Observer's selected words are scored with the *same* normalized scoring
 * core the Subject's self-assessment uses (`score`), giving that Observer an
 * individual 0–1 per-tribe profile. The "others" profile is then the
 * **equal-weight average** of those individual profiles — every Observer counts
 * once, no matter how many words they picked.
 *
 * This is deliberately *not* a pooled bag of words: pooling would let a wordier
 * Observer contribute more and turn effort into influence, but candor — not
 * effort — is the whole value of the 360, so each Observer gets one equal vote.
 *
 * Pure and deterministic (same responses in, same profile out), returning tribes
 * in canonical (tribe `number`) order to match `score`. Server-only because it
 * pulls in the word→tribe mapping via `score`; run it only on the server.
 */

/** A per-tribe pairing of the Subject's own score against the "others" score. */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The aggregated Observers' normalized 0–1 score for this tribe. */
  others: number;
  /** Signed gap `others − self`: positive where others see more, negative less. */
  divergence: number;
}

/** Score each Observer response individually with the shared scoring core. */
export function scoreObservers(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe mean of each Observer's
 * individually-normalized score, in canonical order. With no responses every
 * tribe scores 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = scoreObservers(responses);
  const count = profiles.length;

  return tribes.map((tribe) => {
    let sum = 0;
    for (const profile of profiles) {
      const entry = profile.find((t) => t.slug === tribe.slug);
      sum += entry ? entry.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });
}

/**
 * Pair the Subject's own profile with the aggregated "others" profile, tribe by
 * tribe, with the signed gap (`others − self`) that shows where the two views
 * align and where they diverge. Both inputs are on the same 0–1 normalized
 * scale, so the gap is directly meaningful. Sorted by the Subject's own score so
 * the report reads down from their strongest tribe; ties keep canonical order.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));

  return self
    .map((tribe) => {
      const othersScore = othersBySlug.get(tribe.slug) ?? 0;
      return {
        slug: tribe.slug,
        name: tribe.name,
        self: tribe.score,
        others: othersScore,
        divergence: othersScore - tribe.score,
      };
    })
    .sort((a, b) => b.self - a.self);
}
