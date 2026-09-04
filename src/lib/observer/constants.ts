/**
 * Client-safe constants for the 360 comparison report (issue #9, ADR-0003).
 * Deliberately free of any scoring or word→tribe mapping import, so a client
 * component (e.g. a locked-state banner) can read the threshold without dragging
 * the mapping into the client bundle (ADR-0009 trust boundary).
 *
 * The comparison report unlocks only once at least this many Observers have
 * responded. Below the threshold the aggregated "others" profile would be too
 * thin to be fair — and thin enough that a single Observer's read could be
 * de-anonymized — so the report stays locked until the floor is met.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}
