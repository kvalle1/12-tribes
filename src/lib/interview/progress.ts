import "server-only";

import { MAX_TURNS, MIN_TURNS } from "./confidence";
import { CALIBRATION_TURNS } from "./funnel";
import type { InterviewProgress } from "./types";

/**
 * The Interview's progress indicator (issue #21). The Interview has no fixed
 * length — it runs until the Stop Condition is met, with only a minimum floor
 * (`MIN_TURNS`) and a hard cap (`MAX_TURNS`) bounding it (ADR-0006) — so there
 * is no honest "question N of M" to show. This derives a *rough position*
 * instead: a phase label and a soft fill that grows with each answer but never
 * completes while the Interview is in progress, so it never implies a known
 * total or an imminent end.
 *
 * `server-only`: it is grounded in the scoring thresholds, which live behind the
 * trust boundary; it is read during the Interview page's server render.
 */

/** Fill once the minimum floor is reached — most of the bar, but not the end. */
const FLOOR_SHARE = 0.6;

/** The most the bar can ever fill while in progress; it stops short of full. */
const CEILING = 0.95;

/**
 * A soft 0–1 fill for `answered` Turns. It rises linearly to `FLOOR_SHARE` by
 * the minimum floor, then more gently toward `CEILING` by the cap, and is
 * clamped there — so answering past the cap (should it ever happen) cannot push
 * it to full. It is deliberately asymptotic: the participant sees motion without
 * being told how many questions remain.
 */
function fill(answered: number): number {
  if (answered <= 0) return 0;
  if (answered <= MIN_TURNS) {
    return (answered / MIN_TURNS) * FLOOR_SHARE;
  }
  const span = MAX_TURNS - MIN_TURNS;
  const past = Math.min(answered - MIN_TURNS, span);
  return FLOOR_SHARE + (past / span) * (CEILING - FLOOR_SHARE);
}

function label(answered: number, phase: InterviewProgress["phase"], minReached: boolean): string {
  if (answered <= 0) return "Getting started";
  if (phase === "calibration") return "Getting to know you";
  if (!minReached) return "Building the picture";
  return "Narrowing in";
}

/**
 * Derive the progress view-model from the number of Turns answered so far. The
 * current (pending) question sits at index `answered`, so its Funnel phase is
 * what the participant is in right now (ADR-0005).
 */
export function interviewProgress(answered: number): InterviewProgress {
  const phase: InterviewProgress["phase"] =
    answered < CALIBRATION_TURNS ? "calibration" : "discrimination";
  const minReached = answered >= MIN_TURNS;
  return {
    answered,
    phase,
    minReached,
    fraction: fill(answered),
    label: label(answered, phase, minReached),
  };
}
