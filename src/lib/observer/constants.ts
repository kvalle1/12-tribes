/**
 * Client-safe constants for the 360 Observer flow. Like the assessment
 * `constants.ts`, this module deliberately imports nothing from the word→tribe
 * mapping or the scoring core, so a client component can read it without pulling
 * server-only scoring into the client bundle (ADR-0009).
 *
 * The comparison report (issue #9) unlocks only once enough Observers have
 * responded: below the floor a single voice would carry too much weight and the
 * "others" read would not be meaningfully anonymous, so the report stays locked
 * and the Subject is shown how many more responses are needed.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}
