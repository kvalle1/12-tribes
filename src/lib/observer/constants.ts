/**
 * Client-safe 360 report constants. The self-vs-others comparison report unlocks
 * only once at least this many Observers have responded (ADR-0003) — enough that
 * the "others" view is a genuine aggregate and no single Observer can be singled
 * out from it. Kept free of any `server-only` or word→tribe import so both the
 * server (gating the report) and the client (rendering the locked state) can read
 * it without dragging the mapping into the client bundle (ADR-0009).
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Whether the comparison report may be shown for a Subject with `observerCount`
 * responses. Used on the server to gate rendering the real report; kept in this
 * client-safe module (no `server-only` or word→tribe import) so the client can
 * reuse the same threshold for locked/unlocked copy without dragging the mapping
 * into its bundle.
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}
