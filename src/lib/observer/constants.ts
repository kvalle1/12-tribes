/**
 * Client-safe constants for the 360 comparison report (issue #9, ADR-0003).
 * Free of any scoring or word→tribe import, so both the server report page and
 * any client UI can read the unlock threshold without dragging the mapping into
 * the client bundle (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — so the "others" view is statistically meaningful and no single
 * Observer can be singled out from the aggregate (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}
