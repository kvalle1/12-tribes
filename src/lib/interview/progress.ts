import "server-only";

import { MAX_TURNS, MIN_TURNS, summarize } from "./confidence";
import type { StrengthProfile } from "./types";

/**
 * The in-Interview progress indicator (issue #21) — a rough sense of how far
 * along the participant is, derived purely from the server-authoritative state.
 *
 * The Interview has **no predetermined length** (ADR-0006): it runs a minimum
 * floor, then stops as soon as the evidence is decisive, up to a hard cap. So
 * progress is deliberately *not* a share of any fixed total ("question 7 of
 * 18"). Instead it reads position in two phases:
 *
 *  - **Before the floor** — calibrating. Progress tracks answers toward the
 *    floor but is capped below the midpoint, so a lopsided early lead can never
 *    make it look nearly done.
 *  - **At/after the floor** — the run can end any Turn. Progress rises with the
 *    greater of the result's confidence and how close the Turn count is to the
 *    cap, so it approaches full both when the result is settling *and* when the
 *    cap is forcing an end (the inseparable-top-tribes case).
 *
 * `server-only` (ADR-0009): it reads the scoring engine (`summarize`), so the
 * server component renders the finished indicator and the raw profile stays off
 * the client.
 */

export type InterviewPhase = "calibrating" | "narrowing" | "closing";

export interface InterviewProgress {
  /** Answers recorded so far. */
  answered: number;
  phase: InterviewPhase;
  /** A rough 0..1 sense of position — never a share of a fixed total. */
  fraction: number;
  /** Human-facing copy for the current phase. */
  label: string;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function interviewProgress(
  profile: StrengthProfile,
  answered: number,
): InterviewProgress {
  if (answered < MIN_TURNS) {
    // Capped at the midpoint so the floor always reads as "still getting there".
    const fraction = MIN_TURNS > 0 ? (answered / MIN_TURNS) * 0.5 : 0;
    return {
      answered,
      phase: "calibrating",
      fraction: clamp01(fraction),
      label: "Getting a feel for how you’re wired",
    };
  }

  const result = summarize(profile);
  // "Closing" mirrors the Stop Condition's notion of a reportable result: a
  // decisive margin *and* a separable Primary. Inseparable top tribes keep a
  // high confidence but are not closing — they read as still narrowing.
  const closing = result.confidence >= 1 && !result.coPrimary;

  const capSpan = MAX_TURNS - MIN_TURNS;
  const capProgress = capSpan > 0 ? (answered - MIN_TURNS) / capSpan : 1;
  const closeness = Math.min(1, Math.max(result.confidence, capProgress));

  return {
    answered,
    phase: closing ? "closing" : "narrowing",
    fraction: clamp01(0.5 + 0.5 * closeness),
    label: closing
      ? "Closing in on your result"
      : "Narrowing in on your strengths",
  };
}
