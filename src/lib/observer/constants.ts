/**
 * Client-safe 360 Observer constants. Deliberately free of the scoring core and
 * the word→tribe mapping (which sit behind `server-only` in `aggregate.ts`), so a
 * client component can import the unlock threshold without dragging that mapping
 * into the client bundle — mirroring `assessment/constants.ts` (ADR-0009).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below the threshold the average isn't meaningful and
 * individual anonymity is weaker, so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;
