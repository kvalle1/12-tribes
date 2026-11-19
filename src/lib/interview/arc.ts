import { statusLabels, type TribeStatus } from "@/lib/tribes";
import type { PostureLean } from "./types";

/**
 * Arc-aware result framing (ADR-0004 / ADR-0007) — pure, client-safe copy.
 *
 * Scoring is status-blind: all 12 tribes, including the disqualified ones, are
 * eligible as Primary. That makes "your Primary is a disqualified tribe" a valid
 * result that needs careful, non-condemning framing rather than a scoring gate.
 * This module turns a tribe's `status` and the participant's Posture lean into
 * that framing. Posture gives the copy its hook: an `integrated` lean reads as
 * redemption (the wiring lived from the far side of its fall line), an
 * `active-shadow` lean reads as caution (the fall line is live territory now).
 *
 * The `status` field describes a tribe's fate in the biblical narrative, never a
 * verdict on the person — so the copy names the warning without condemning.
 */

/** Human label for an arc position, for a short tag beside a tribe. */
export function postureLabel(lean: PostureLean): string {
  switch (lean) {
    case "integrated":
      return "Integrated";
    case "active-shadow":
      return "Active shadow";
    default:
      return "Mid-arc";
  }
}

/** The status-specific, non-condemning preface for a non-active Primary. */
const STATUS_PREFACE: Record<Exclude<TribeStatus, "active">, string> = {
  disqualified:
    "This tribe carries a disqualification in the biblical narrative — a severe warning, not a verdict on you. The wiring itself is real, common, and needed; what the story cautions against is where it leads when it runs unchecked.",
  "disqualified-arc":
    "This tribe carries a disqualification arc in the biblical narrative — endurance that pushed past its own limits. It names a pattern worth watching, not a judgment on your worth.",
  warning:
    "This is a warning tribe — unusual capacity paired with a real failure mode. The caution is about stewarding the gift, not condemnation.",
};

/** The Posture-driven reading appended to the preface. */
function arcReading(lean: PostureLean): string {
  switch (lean) {
    case "integrated":
      return "Your answers lean integrated — the redemption reading. You describe this wiring from the far side of its fall line, the way its redeemed examples lived it.";
    case "active-shadow":
      return "Your answers lean toward the active shadow — the cautionary reading. The fall line is live territory for you right now, which is exactly where this tribe's warning is worth heeding.";
    default:
      return "Your answers sit mid-arc, neither clearly in the shadow nor fully integrated, so hold the caution and the redemption together.";
  }
}

export interface ArcFraming {
  heading: string;
  note: string;
}

/**
 * Framing for a Primary tribe given its status and Posture lean, or `null` for
 * an `active` tribe (nothing to caution). The heading pairs the status label
 * with the arc position; the note is the non-condemning preface plus the
 * Posture reading.
 */
export function arcFraming(status: TribeStatus, lean: PostureLean): ArcFraming | null {
  if (status === "active") return null;
  return {
    heading: `${statusLabels[status]} · ${postureLabel(lean)}`,
    note: `${STATUS_PREFACE[status]} ${arcReading(lean)}`,
  };
}
