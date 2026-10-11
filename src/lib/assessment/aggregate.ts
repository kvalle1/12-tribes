import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer's words are scored through the same pure core as the Self
 * Assessment (`score`), producing their individually-normalized 0–1 per-tribe
 * profile. The "others" profile is the **equal-weight mean** of those
 * per-observer profiles — *not* a pooled bag of words. Averaging normalized
 * profiles (rather than pooling words) means an Observer who happens to pick
 * more words never gains more influence: every Observer contributes exactly
 * `1 / n` of the result.
 *
 * Server-only because it reuses `score`, which carries the word→tribe mapping
 * behind the ADR-0009 trust boundary. The comparison report renders on the
 * server; the client only ever receives already-computed scores.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks (ADR-0003). At least three both makes the average meaningful and
 * preserves anonymity — no single Observer can be isolated from the aggregate.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(responseCount: number): boolean {
  return responseCount >= MIN_OBSERVERS;
}

/** The all-zero profile in canonical (tribe `number`) order. */
function zeroProfile(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Equal-weight mean of already-scored per-observer profiles — a normalized 0–1
 * score per tribe, in canonical (tribe `number`) order. Every profile
 * contributes exactly `1 / n`, so an Observer who picked more words gains no
 * extra influence. With no profiles the result is all zeros. Inputs are not
 * mutated.
 *
 * Works on scored profiles (not words) so the report page can score each
 * Observer once and feed those same profiles to both this aggregate and the
 * per-observer drill-down — the two can never drift apart. Each profile is
 * assumed to be in canonical order (as `score` returns), so positions line up.
 */
export function averageProfiles(
  profiles: readonly TribeScore[][],
): TribeScore[] {
  if (profiles.length === 0) return zeroProfile();

  const totals = zeroProfile();
  for (const profile of profiles) {
    for (let i = 0; i < totals.length; i++) {
      totals[i].score += profile[i].score;
    }
  }

  for (const tribe of totals) tribe.score /= profiles.length;
  return totals;
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile — a
 * normalized 0–1 score per tribe, in canonical (tribe `number`) order, matching
 * the shape `score` returns so the two profiles can be compared directly.
 *
 * Each response is the set of words one Observer selected. With no responses the
 * profile is all zeros. Inputs are not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  return averageProfiles(responses.map((words) => score(words)));
}
