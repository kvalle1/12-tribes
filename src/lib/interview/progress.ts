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
 *  - **At/after the floor** — the run can end any Turn. The bar advances with
 *    the Turn count toward the cap and nothing else, so it is monotonic and
 *    never slides backwards when fresh evidence narrows the lead. The *phase
 *    label* carries the confidence signal — *closing* once the margin is
 *    decisive and the Primary separable, *narrowing* otherwise.
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
  // MAX_TURNS > MIN_TURNS >= 1 by construction (ADR-0006), so neither divisor
  // below is zero.
  if (answered < MIN_TURNS) {
    // Capped at the midpoint so the floor always reads as "still getting there".
    const fraction = (answered / MIN_TURNS) * 0.5;
    return {
      answered,
      phase: "calibrating",
      fraction: clamp01(fraction),
      label: "Getting a feel for how you’re wired",
    };
  }

  // The bar advances with the Turn count alone — monotonic, so it never slides
  // backwards when later evidence narrows the lead.
  const capProgress = (answered - MIN_TURNS) / (MAX_TURNS - MIN_TURNS);

  const result = summarize(profile);
  // "Closing" mirrors the Stop Condition's notion of a decisive, separable
  // margin. It is descriptive, not a promise to stop — leader-stability is also
  // required to stop, so the run may still ask more; the wording stays soft.
  // Inseparable top tribes keep a high confidence but read as still narrowing.
  const inFocus = result.confidence >= 1 && !result.coPrimary;

  return {
    answered,
    phase: inFocus ? "closing" : "narrowing",
    fraction: clamp01(0.5 + 0.5 * capProgress),
    label: inFocus
      ? "Your strengths are coming into focus"
      : "Narrowing in on your strengths",
  };
}
