import "server-only";

import { statusLabels, type TribeStatus } from "@/lib/tribes";
import type {
  PostureArc,
  PostureProfile,
  ScoreTraceEntry,
  TribePosture,
} from "./types";

/**
 * The Posture axis (ADR-0004) — pure aggregation of where each tribe sits on its
 * fall→oil arc, plus the status-aware framing that reading unlocks.
 *
 * Posture is orthogonal to strength: it is tallied from the same scored deltas
 * but never feeds back into strength. It reads *how* a wiring shows up (toward
 * active-shadow or toward integrated), while strength reads *whether* it is
 * present at all. The two are surfaced side by side in the result.
 *
 * `server-only`: Posture is a scoring/interpretation concern derived from the
 * authoritative score trace, computed on the server and never recomputed on the
 * client (ADR-0009). The result page is a server component and reads this.
 */

/**
 * How far the posture-bearing evidence must lean — as a fraction of its total,
 * on a −1 (all active-shadow) to +1 (all integrated) scale — before a tribe is
 * called to one pole rather than `mixed`. A clean 2:1 lean (⅓) just tips it.
 */
export const POSTURE_ARC_THRESHOLD = 1 / 3;

/**
 * Classify a tribe's arc from its two accumulated posture weights. `unknown`
 * when no posture-bearing evidence exists (only neutral strength signals);
 * `mixed` when the evidence pulls both ways without clearing the threshold.
 */
export function classifyArc(activeShadow: number, integrated: number): PostureArc {
  const bearing = activeShadow + integrated;
  if (bearing <= 0) return "unknown";
  const lean = (integrated - activeShadow) / bearing;
  if (lean >= POSTURE_ARC_THRESHOLD) return "integrated";
  if (lean <= -POSTURE_ARC_THRESHOLD) return "active-shadow";
  return "mixed";
}

/**
 * Accumulate each tribe's Posture from the score trace. Every `integrated` or
 * `active-shadow` entry adds its delta weight to the matching pole; `neutral`
 * entries drive strength only and are ignored here (ADR-0004). Replaying the
 * persisted trace keeps Posture derivable with no extra stored state, the same
 * way the Confidence evaluator replays history.
 */
export function summarizePosture(
  trace: readonly ScoreTraceEntry[],
): PostureProfile {
  const poles = new Map<string, { activeShadow: number; integrated: number }>();
  for (const entry of trace) {
    // Register every tribe with any evidence, so a tribe carried only by
    // neutral (strength) signals still appears with an `unknown` arc rather
    // than vanishing. Neutral entries add no posture weight (ADR-0004).
    const pole = poles.get(entry.tribeSlug) ?? { activeShadow: 0, integrated: 0 };
    if (entry.postureSignal === "integrated") pole.integrated += entry.delta;
    else if (entry.postureSignal === "active-shadow") pole.activeShadow += entry.delta;
    poles.set(entry.tribeSlug, pole);
  }

  const profile: PostureProfile = {};
  for (const [slug, pole] of poles) {
    profile[slug] = {
      activeShadow: pole.activeShadow,
      integrated: pole.integrated,
      arc: classifyArc(pole.activeShadow, pole.integrated),
    } satisfies TribePosture;
  }
  return profile;
}

/** Human-facing label for each arc position, for the result view. */
export const ARC_LABELS: Record<PostureArc, string> = {
  "active-shadow": "Active shadow",
  mixed: "Finding balance",
  integrated: "Integrated",
  unknown: "Not yet read",
};

/**
 * Non-condemning, arc-aware framing for a Primary whose tribe carries a
 * non-`active` status (ADR-0007). The status names the *fate in the narrative*,
 * not a verdict on the person; Posture gives the reading its hook — active-shadow
 * is a caution to heed, integrated is a redemption already underway, and mixed
 * leaves the arc openly unfinished. Returns empty copy for an `active` tribe,
 * which needs no status-aware framing.
 *
 * The content already carries the redeemed exemplars this leans on (Nehemiah for
 * Dan, Simeon of Luke 2, Paul for Benjamin); the copy keeps to the arc so it
 * reads the same whichever non-`active` tribe lands as Primary.
 */
export function arcFraming(status: TribeStatus, arc: PostureArc): string {
  if (status === "active") return "";

  const label = statusLabels[status];
  const base = `The tradition marks this tribe a ${label} — a severe warning about its pattern, never a verdict on you. The wiring itself is real and needed; the warning is about where it can go.`;

  switch (arc) {
    case "integrated":
      return `${base} Your answers lean toward the redemption of that pattern, not its fall line — the matured reading the tribe's redeemed exemplars point to. Keep walking it.`;
    case "active-shadow":
      return `${base} Your answers lean toward its shadow right now. Read that as a caution to heed while the arc is still open, not a sentence — the same tribe has a named way back.`;
    default:
      return `${base} Your answers sit between its shadow and its redemption; where you land on the arc is still being written.`;
  }
}
