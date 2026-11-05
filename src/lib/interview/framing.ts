import type { TribeStatus } from "@/lib/tribes";
import type { PostureReading } from "./types";

/**
 * Arc-aware, non-condemning framing for a Primary whose tribe carries a
 * non-`active` status (ADR-0004 / ADR-0007, slice 6).
 *
 * Scoring is status-blind: all 12 tribes, the `disqualified` ones included, are
 * eligible as Primary. That makes "your Primary is Simeon (disqualified)" a
 * valid result — a *writing* problem, not a scoring one. This module is where
 * that writing lives: a tribe's `status` says what the tradition flags about the
 * pattern, and the participant's **Posture** reading says where they sit on its
 * fall→oil arc. The two together pick the reading — `integrated` gets the
 * redemption framing the tribe's redeemed exemplars embody; `active-shadow` gets
 * the cautionary one — and neither condemns the participant.
 *
 * Pure and client-safe: the result page (a server component) renders it, but it
 * holds no scoring state, so it is unit-testable without the server boundary.
 */

export interface ArcFraming {
  /** A short badge for the arc, e.g. "Redemption arc". */
  arcLabel: string;
  /** One non-condemning paragraph tying the tribe's status to the posture reading. */
  note: string;
}

/** What the tradition flags about each non-`active` status, phrased plainly. */
const STATUS_CAUTION: Record<Exclude<TribeStatus, "active">, string> = {
  disqualified:
    "absent from Revelation 7's 144,000 — a severe warning, and an invitation to restoration rather than a permanent rejection",
  warning:
    "a warning pattern, whose fruit cautions the people around it toward movement",
  "disqualified-arc":
    "marked by a historical disqualification arc — first into captivity, and no recovery narrative — which the tradition holds up as a severe warning",
};

const ARC_LABEL: Record<PostureReading, string> = {
  integrated: "Redemption arc",
  "active-shadow": "Cautionary arc",
  mixed: "Arc in motion",
  unknown: "Arc unread",
};

/**
 * Framing copy for a Primary tribe, or `null` when the tribe's status is
 * `active` (an active tribe needs no special arc framing). The posture reading
 * chooses between the redemption and cautionary readings; both name the pattern
 * honestly without condemning the person.
 */
export function arcFraming(
  status: TribeStatus,
  posture: PostureReading,
): ArcFraming | null {
  if (status === "active") return null;

  const caution = STATUS_CAUTION[status];
  const arcLabel = ARC_LABEL[posture];

  const reading: Record<PostureReading, string> = {
    integrated:
      `This wiring carries a caution in the tradition — ${caution}. Your answers, ` +
      "though, read as integrated: you resonate with the pattern and show signs of " +
      "having grown past its fall line. That hard-won maturity is itself evidence the " +
      "wiring is yours, and it is exactly the redemption arc the tradition holds open — " +
      "its redeemed figures walked this same road. The warning names a danger to keep " +
      "moving past, never a verdict on you.",
    "active-shadow":
      `This wiring carries a caution in the tradition — ${caution}. Your answers read ` +
      "closer to the active-shadow end of its arc than the integrated one, so take this " +
      "as the cautionary reading it is meant to be: the pattern is real and valuable, and " +
      "naming where it tends to go wrong is an invitation to move toward the tribe's oil, " +
      "not a condemnation.",
    mixed:
      `This wiring carries a caution in the tradition — ${caution}. Your answers pull both ` +
      "ways along its arc — some toward the fall line, some past it — so hold the caution " +
      "and the growth together: the pattern is real, and the work is to keep moving toward " +
      "the tribe's oil.",
    unknown:
      `This wiring carries a caution in the tradition — ${caution}. The Interview did not ` +
      "gather enough posture-bearing signal to place you on its arc, so read the caution as " +
      "context rather than a verdict: the pattern is real and valuable, and its danger is " +
      "something to keep moving past.",
  };

  return { arcLabel, note: reading[posture] };
}

/** A short, human label for a posture reading, for the per-tribe arc position. */
const POSTURE_LABEL: Record<PostureReading, string> = {
  integrated: "Integrated",
  "active-shadow": "Active shadow",
  mixed: "In motion",
  unknown: "Unread",
};

export function postureLabel(posture: PostureReading): string {
  return POSTURE_LABEL[posture];
}
