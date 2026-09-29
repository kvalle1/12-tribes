/**
 * Client-safe 360 comparison constants. Like the assessment's `constants.ts`,
 * this deliberately imports neither the word→tribe mapping nor the scoring core,
 * so a client component can gate on the unlock threshold without dragging the
 * mapping into the client bundle (ADR-0009 trust boundary).
 */

/**
 * How many Observer responses must exist before the comparison report unlocks
 * (ADR-0003). Three is the point at which the equal-weight "others" average
 * becomes meaningful and individual observers stay anonymous in the drill-down.
 */
export const MIN_OBSERVERS = 3;

/**
 * Whether enough Observers have responded to unlock the comparison report.
 * Applied on the result page (to show progress toward the unlock) and on the
 * report page (to gate the report itself), so the threshold lives here once.
 */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}
