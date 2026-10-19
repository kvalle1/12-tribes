/**
 * Client-safe 360 comparison constants. Like `assessment/constants.ts`, this
 * module deliberately imports neither the word→tribe mapping nor the scoring
 * core, so a client component can read the unlock rule without dragging the
 * mapping into the client bundle (ADR-0009 trust boundary).
 */

/**
 * How many Observer responses must exist before the comparison report unlocks
 * (issue #9, ADR-0003). Three is the floor at which an equal-weight "others"
 * average carries enough signal to be worth showing — and, just as important,
 * it keeps any single Observer from being identifiable by their lone response.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/**
 * Whether the self-vs-others comparison report may be shown for a Subject with
 * `observerCount` responses. Applied server-side (to gate the report) and by the
 * UI (to choose the locked vs. unlocked state), so the rule lives here once.
 */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}
