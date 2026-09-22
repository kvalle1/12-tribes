/**
 * Client-safe 360 aggregation constants. Deliberately free of any import of the
 * word→tribe mapping or the scoring core (both `server-only`), so a client
 * component — e.g. the anonymous per-observer drill-down — can read the unlock
 * threshold without dragging the mapping into the client bundle (ADR-0009 trust
 * boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). The floor makes the equal-weight average meaningful and
 * preserves each Observer's anonymity — with fewer responses a Subject could
 * infer who said what.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}
