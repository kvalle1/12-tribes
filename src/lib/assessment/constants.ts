/**
 * Client-safe selection constants and the submission gate. Deliberately free of
 * any import of the word→tribe mapping (`words.ts`) or the scoring core, so a
 * client component can import these without dragging the mapping into the client
 * bundle (ADR-0009 trust boundary). The mapping-bearing modules are marked
 * `server-only`; this module is the small client-shareable surface they sit
 * behind.
 *
 * Selection constraints — how many words a participant picks. These bounds gate
 * submission (too few words yields a noisy result; too many flattens the signal)
 * and are intended to be tuned with real data.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * Whether a selection of `count` words may be submitted. Applied client-side (to
 * enable the submit button) and server-side (to reject out-of-range submissions),
 * so it lives here once.
 */
export function isWithinSelectionRange(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}

/**
 * The minimum number of 360 Observer responses before the self-vs-others
 * comparison report unlocks (ADR-0003). Below this the "others" view would be
 * both statistically thin and thin enough to de-anonymize an individual
 * Observer, so the report stays locked. Lives here (client-safe, no scoring
 * import) so the locked-state UI and the aggregation logic share one threshold.
 */
export const MIN_OBSERVERS = 3;

/**
 * Whether `count` Observer responses is enough to unlock the comparison report.
 */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}
