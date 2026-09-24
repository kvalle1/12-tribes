import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Equal-weight aggregation of 360 Observer responses into a single "others"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer's word selection is scored independently by the same normalized
 * scoring core the Self flow uses (`score`, ADR-0001/0002), then the per-tribe
 * "others" profile is the **equal-weight average** of those per-observer
 * profiles — every Observer contributes exactly one profile to the mean.
 *
 * Averaging *normalized profiles* rather than pooling everyone's words into one
 * bag is the point: an Observer who picks fifteen words has already been
 * normalized to a 0–1 profile before averaging, so they get no more influence
 * on the result than an Observer who picks eight. Pooling would let a
 * word-happy Observer dominate; equal-weight averaging gives one Observer, one
 * vote.
 *
 * Pure and dependency-free apart from the (server-only) scoring core, so it is
 * unit-testable in isolation and reused unchanged by the comparison report.
 */

/**
 * Average the per-observer normalized profiles into a single "others" profile,
 * one entry per tribe in canonical (tribe `number`) order — the same shape and
 * order `score` returns, so it drops into the ranking/comparison helpers
 * unchanged. An empty set of responses yields an all-zero profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = responses.map((words) => score(words));
  const observerCount = profiles.length;

  return tribes.map((tribe) => {
    const total = profiles.reduce((sum, profile) => {
      const entry = profile.find((s) => s.slug === tribe.slug);
      return sum + (entry?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });
}
