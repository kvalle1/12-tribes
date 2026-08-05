/**
 * Client-safe 360 Observer constants. Deliberately free of any server-only or
 * mapping-bearing import so a client component (e.g. a locked-state notice) can
 * read the threshold without dragging the word→tribe mapping into the bundle.
 *
 * The self-vs-others comparison report unlocks only once at least this many
 * Observers have responded (ADR-0003). The floor both makes the equal-weight
 * average meaningful and preserves each Observer's anonymity — with fewer than
 * three responses an individual read would be too easy to single out.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}
