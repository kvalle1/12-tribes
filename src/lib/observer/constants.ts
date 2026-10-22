/**
 * Client-safe 360 report constants and the unlock gate. Deliberately free of any
 * import of the word→tribe mapping or the scoring core, so a client component can
 * read these without dragging server-only logic into the client bundle (ADR-0009
 * trust boundary) — mirroring the pattern in `assessment/constants.ts`.
 */

/**
 * How many anonymous Observer responses a Subject needs before the comparison
 * report unlocks (ADR-0003). Below this the "others" view would reveal too much
 * about a single Observer and carry too little signal, so the report stays
 * locked. Three is the agreed floor; tunable.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/**
 * Whether the comparison report may be shown for a Subject with `observerCount`
 * responses. Used by the report page to choose between the locked state and the
 * real self-vs-others comparison.
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}
