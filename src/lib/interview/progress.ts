/**
 * Interview progress indicator (slice 7, issue #21).
 *
 * The Interview has no fixed length: it runs until the Stop Condition is met,
 * anywhere between the minimum floor and the hard cap (ADR-0006). So progress
 * here is deliberately *rough* and must never imply a fixed number of
 * questions — no "question 3 of 10". The bar fills a clear majority by the time
 * the minimum floor is reached (from there the Interview may stop at any Turn,
 * so it is honestly "near the end"), then ramps the rest of the way toward a
 * ceiling just below full, reaching that ceiling only at the hard cap. It never
 * reaches 100% while a question is still pending.
 *
 * Pure and parameterized: the caller passes the floor/cap from the
 * Confidence/Stop evaluator's constants, so this module carries no server-only
 * dependency and stays trivially testable.
 */

export type ProgressPhase = "warming-up" | "homing-in" | "almost-there";

export interface Progress {
  /** 0..1, non-decreasing in `answered`, and strictly < 1 while in progress. */
  fraction: number;
  phase: ProgressPhase;
}

/** Share of the bar filled by the time the minimum floor is reached. */
export const FLOOR_FRACTION = 0.7;

/** The bar never fills past this while a question is still pending. */
export const MAX_IN_PROGRESS = 0.95;

/** Phase thresholds on the filled fraction. */
const WARMING_UP_BELOW = 0.4;
const ALMOST_THERE_AT = 0.85;

/**
 * The rough progress of an in-progress Interview.
 *
 * @param answered Turns the participant has completed so far.
 * @param floor    Minimum Turns before a result is possible (MIN_TURNS).
 * @param cap       Hard maximum Turns (MAX_TURNS).
 */
export function interviewProgress(
  answered: number,
  floor: number,
  cap: number,
): Progress {
  const done = Number.isFinite(answered) ? Math.max(0, answered) : 0;

  let fraction: number;
  if (done <= 0) {
    fraction = 0;
  } else if (done < floor) {
    // Pre-floor: linear ramp to the floor share. At least `floor` questions are
    // guaranteed, so progress toward the floor is honest.
    fraction = (done / floor) * FLOOR_FRACTION;
  } else {
    // Past the floor the Interview can stop any Turn; ramp the remaining band
    // so the ceiling is reached only at the cap — never a premature freeze, and
    // never full while a question is still pending.
    const span = cap > floor ? Math.min(1, (done - floor) / (cap - floor)) : 1;
    fraction = FLOOR_FRACTION + (MAX_IN_PROGRESS - FLOOR_FRACTION) * span;
  }

  const phase: ProgressPhase =
    fraction < WARMING_UP_BELOW
      ? "warming-up"
      : fraction < ALMOST_THERE_AT
        ? "homing-in"
        : "almost-there";

  return { fraction, phase };
}
