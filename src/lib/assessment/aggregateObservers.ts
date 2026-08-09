import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of the 360 Observer responses into a single "others"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer is scored *individually* by the shared, normalized scoring core
 * (`score`), then the per-tribe scores are averaged with **equal weight** — one
 * vote per Observer, regardless of how many words they picked. This is
 * deliberately *not* a pooled bag of words: pooling would let a verbose Observer
 * (or one who happens to overlap another's words) dominate the "others" view.
 * Averaging already-normalized profiles keeps every Observer's say equal.
 *
 * The result has the same `TribeScore[]` shape (all 12 tribes, canonical order)
 * as the Self profile, so the comparison report can rank and draw both with the
 * same helpers. Pure and deterministic; reuses the scoring core unchanged.
 *
 * This module transitively imports the `server-only` scoring core, so it never
 * reaches the client bundle — the word→tribe mapping stays server-side.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003), so the "others" view is meaningful in aggregate and no
 * individual Observer can be singled out.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function hasEnoughObservers(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * Aggregate the Observer responses (each the words one Observer selected) into
 * the equal-weight "others" profile. Returns an all-zero profile for no
 * observers. Unknown/duplicate words are handled by `score` per observer.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = responses.map((words) => score(words));

  return tribes.map((tribe) => {
    const total = profiles.reduce((sum, profile) => {
      const entry = profile.find((s) => s.slug === tribe.slug);
      return sum + (entry?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: profiles.length > 0 ? total / profiles.length : 0,
    };
  });
}
