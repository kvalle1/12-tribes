import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Each Observer's selected words are scored *individually* with the
 * same normalized scoring core the Subject uses (`score`), then the per-tribe
 * "others" profile is the **equal-weight average** of those per-observer
 * profiles — not a single score over a pooled bag of everyone's words.
 *
 * Averaging normalized per-observer profiles (rather than pooling words) is what
 * keeps every Observer's voice equal: an Observer who picks more words does not
 * gain more influence, because their own profile is normalized to 0–1 before it
 * is averaged in. Pure and dependency-free (beyond the scoring core it reuses),
 * so it is unit-testable without the DB or the LLM.
 */

/** Observer responses must reach this count before the comparison report unlocks. */
export const MIN_OBSERVERS = 3;

/**
 * Whether the self-vs-others comparison report may be shown. Gated at
 * `MIN_OBSERVERS` so the aggregate is meaningful and no single Observer can be
 * singled out from too small a pool (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer response independently, returning one normalized profile
 * per response (each a full 12-tribe `TribeScore[]` in canonical order). Used
 * both to build the equal-weight average and to back the anonymous per-observer
 * drill-down (Observer 1/2/3). Order follows the input, so callers that pass
 * responses oldest-first get stable Observer numbering.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe average of each Observer's
 * individually-normalized score. Returns a 12-tribe `TribeScore[]` in canonical
 * order, matching the Subject's own `score()` output so the two can be shown
 * side by side. With no responses every tribe averages to 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = scoreEachObserver(responses);

  // Every profile is in canonical (tribe `number`) order, so index `i` lines up
  // with `tribes[i]` across all of them — average tribe-by-tribe by position.
  return tribes.map((tribe, i) => {
    const total = profiles.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: profiles.length > 0 ? total / profiles.length : 0,
    };
  });
}
