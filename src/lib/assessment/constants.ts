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
 * The number of anonymous Observer responses required before a Subject's 360
 * comparison report unlocks (issue #9, ADR-0003). Below this the "others"
 * profile stays hidden — both so the equal-weight average is meaningful and so
 * no single Observer can be individually identified. Client-safe (it drives the
 * locked-state copy) and re-checked on the server before the aggregate is built.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;
