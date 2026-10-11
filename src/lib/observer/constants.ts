/**
 * Client-safe constants for the 360 comparison report (issue #9, ADR-0003).
 *
 * Deliberately free of any import of the word→tribe mapping or the scoring core,
 * so a client component can import the unlock threshold without dragging scoring
 * logic into the client bundle (ADR-0009 trust boundary).
 */

/**
 * The minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Three both makes the equal-weight average meaningful and preserves
 * each Observer's anonymity at the individual level.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}
