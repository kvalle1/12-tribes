import type { TribeStatus } from "@/lib/tribes";
import type { ArcPosition } from "./types";

/**
 * Non-condemning, status- and arc-aware framing for a Primary tribe whose
 * `status` is not `active` (slice 6, ADR-0007). Scoring is status-blind — every
 * tribe, disqualified ones included, can be a Primary — so when it lands on a
 * disqualified/warning tribe the result must read it honestly without judgment.
 *
 * Two readings sit on one arc: at the `active-shadow` end a *cautionary* reading
 * (the pattern to name and turn), at the `integrated` end a *redemption* reading
 * (already living the tribe from the far side of its fall line). The base line
 * states, gently, what the status means; the arc line, when the Posture axis has
 * a reading, says which way the participant is walking it.
 *
 * Returns `null` for an `active` tribe (nothing to frame) and a single paragraph
 * otherwise. Pure and client-safe so the result page and tests can both use it.
 */

const STATUS_FRAMING: Record<Exclude<TribeStatus, "active">, string> = {
  disqualified:
    "This tribe is absent from Revelation 7 — read that as a severe warning, not a permanent verdict. Restoration is on offer; the pattern only has to be named and turned.",
  "disqualified-arc":
    "This tribe carries a historical disqualification arc — a serious caution rather than a sentence. It still appears among the sealed, so the arc can be walked the other way.",
  warning:
    "This is a warning tribe: a place to move through, not to settle into. Its fruit is meant to press you onward into the other tribes, not to keep you here.",
};

const ARC_FRAMING: Record<Exclude<ArcPosition, "unknown" | "mixed">, string> = {
  integrated:
    "Your answers read as integrated — you speak about this wiring from the far side of its fall line, which is exactly the redemption the arc points toward.",
  "active-shadow":
    "Your answers sit nearer the active-shadow end of this tribe's arc. Take it as a flag to watch, not a judgment — the way up is the tribe's oil.",
};

export function arcFraming(status: TribeStatus, arc: ArcPosition): string | null {
  if (status === "active") return null;
  const base = STATUS_FRAMING[status];
  const arcLine = arc === "unknown" || arc === "mixed" ? null : ARC_FRAMING[arc];
  return arcLine ? `${base} ${arcLine}` : base;
}
