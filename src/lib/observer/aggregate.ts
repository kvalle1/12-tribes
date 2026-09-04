import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003). Server-only: it pulls in the scoring core (and through
 * it the word→tribe mapping), which must never reach the client (ADR-0009).
 *
 * The key design decision is **equal weight per Observer**. Each Observer's
 * words are scored individually with the exact same normalized core the Self
 * flow uses (`score`), producing one 0–1-per-tribe profile per Observer. The
 * "others" profile is then the plain average of those per-Observer profiles —
 * NOT a single score over a pooled bag of everyone's words. Pooling would let an
 * Observer who selects more words push the result around more than one who
 * selects fewer; averaging normalized profiles gives every Observer exactly one
 * equal vote regardless of how many words they picked.
 */

export interface ObserverResponseInput {
  /** The words this Observer selected to describe the Subject. */
  words: readonly string[];
}

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  count: number;
  /**
   * The equal-weight average "others" profile: for each tribe, the mean of the
   * per-Observer normalized scores. Returned in canonical (tribe `number`) order
   * — the same order `score` uses — so it lines up index-for-index with a Self
   * profile. When there are no responses every tribe scores 0.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in input order (so callers can label
   * them Observer 1, Observer 2, …). Backs the anonymous per-observer drill-down:
   * it carries only the scored profile, never anything identifying an Observer.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile plus the
 * per-Observer profiles for drill-down. Pure and deterministic: same responses
 * in the same order always yield the same result, and the input is never
 * mutated.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): ObserverAggregate {
  // Score each Observer independently — one normalized profile each. `score`
  // returns tribes in canonical order, so every profile is index-aligned.
  const perObserver = responses.map((response) => score(response.words));

  const others: TribeScore[] = tribes.map((tribe, tribeIndex) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + profile[tribeIndex].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      // Equal weight: divide by the number of Observers, not the number of
      // words. An Observer who picked 15 words counts exactly as much as one who
      // picked 8.
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { count: responses.length, others, perObserver };
}
