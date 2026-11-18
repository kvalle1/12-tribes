import "server-only";

import type { TribeStatus } from "@/lib/tribes";
import type { ArcPosition, ScoreTraceEntry, TribePosture } from "./types";

/**
 * The Posture axis (ADR-0004) — pure functions that fold the score trace's
 * per-answer {@link PostureSignal}s into a per-tribe arc position. Posture is a
 * *projection* of the trace: it is derived, never persisted, so it stays in
 * lock-step with the evidence and needs no migration. It rides alongside
 * strength and, by construction here, cannot change it — this module only reads
 * `postureSignal`, never a tribe's score.
 *
 * `server-only` keeps it on the authoritative side of the ADR-0009 trust
 * boundary with the rest of the scoring engine: Posture is read from the trace
 * during RSC render and surfaced as a label, but the raw trace never ships to
 * the client.
 */

/**
 * How far the normalized lean must tip before the arc reads as one pole rather
 * than `mixed`. A third keeps `mixed` a genuine middle band (a lone integrated
 * vs a lone active-shadow signal of equal weight stays mixed) without demanding
 * near-unanimity to call a lean.
 */
export const POSTURE_LEAN_THRESHOLD = 1 / 3;

/** A tribe with no posture-bearing evidence yet. */
export function emptyPosture(): TribePosture {
  return { integrated: 0, activeShadow: 0, lean: 0, arc: "neutral" };
}

/** The labelled arc position for a normalized lean and the evidence behind it. */
function arcFor(lean: number, evidence: number): ArcPosition {
  if (evidence <= 0) return "neutral";
  if (lean >= POSTURE_LEAN_THRESHOLD) return "integrated";
  if (lean <= -POSTURE_LEAN_THRESHOLD) return "active-shadow";
  return "mixed";
}

/**
 * Fold the score trace into a per-tribe Posture, keyed by tribe slug. Each entry
 * contributes its `delta` (the strength it carried) to the `integrated` or
 * `activeShadow` pole according to its `postureSignal`; `neutral` answers are not
 * posture-bearing and move nothing. `lean` is the normalized difference of the
 * poles in [-1, 1], so a tribe scored only by neutral answers reads `neutral`,
 * never a false lean.
 *
 * Weighting by `delta` (ADR-0004) means stronger evidence moves Posture more:
 * one decisive integrated answer outweighs several faint shadow ones. A matured
 * fall-line — which `flow.applyTurn` routes to the tribe's oil Marker (via
 * `routeMaturedFallLines`) carrying its `integrated` signal before it reaches the
 * trace — therefore pulls Posture toward integrated here. This reads only
 * `postureSignal` and `delta`, never a tribe's score, so Posture can never move
 * strength.
 *
 * Only tribes that appear in the trace are returned; use {@link postureFor} to
 * read a tribe that may be absent and get a neutral default.
 */
export function accumulatePosture(
  trace: readonly ScoreTraceEntry[],
): Record<string, TribePosture> {
  const byTribe: Record<string, TribePosture> = {};

  for (const e of trace) {
    if (e.postureSignal === "neutral") {
      // Still register the tribe so it exists in the map, but move no posture.
      byTribe[e.tribeSlug] ??= emptyPosture();
      continue;
    }
    const posture = (byTribe[e.tribeSlug] ??= emptyPosture());
    const weight = Math.max(0, e.delta);
    if (e.postureSignal === "integrated") posture.integrated += weight;
    else posture.activeShadow += weight;
  }

  for (const posture of Object.values(byTribe)) {
    const evidence = posture.integrated + posture.activeShadow;
    posture.lean = evidence > 0 ? (posture.integrated - posture.activeShadow) / evidence : 0;
    posture.arc = arcFor(posture.lean, evidence);
  }

  return byTribe;
}

/** A tribe's Posture from an accumulated map, defaulting to neutral when absent. */
export function postureFor(
  postureByTribe: Record<string, TribePosture>,
  slug: string,
): TribePosture {
  return postureByTribe[slug] ?? emptyPosture();
}

/** A short, human-readable label for an arc position. */
export function arcLabel(arc: ArcPosition): string {
  switch (arc) {
    case "integrated":
      return "Integrated";
    case "active-shadow":
      return "Active shadow";
    case "mixed":
      return "Mid-arc";
    case "neutral":
      return "Unread";
  }
}

/**
 * Grammatical fragment for each non-`active` status, dropped into "carries a ___
 * history". Built as a dedicated phrase rather than lower-casing the display
 * label, whose multi-word forms ("Warning Tribe", "Disqualified Arc") read
 * awkwardly inline.
 */
const STATUS_PHRASE: Record<Exclude<TribeStatus, "active">, string> = {
  disqualified: "disqualified",
  warning: "warning-tribe",
  "disqualified-arc": "disqualified-arc",
};

/**
 * Non-condemning, arc-aware framing for a tribe surfaced as a Primary/Contender
 * (ADR-0004 × ADR-0007). `status` describes the tribe's fate in the biblical
 * narrative, never a verdict on the participant; Posture gives the copy its
 * hook — active-shadow reads as a caution, integrated as redemption.
 *
 * Active tribes get a light arc reading and no status language (and nothing at
 * all when posture is `neutral`). The flagged tribes (`disqualified`, `warning`,
 * `disqualified-arc`) always get framing — the status is worth naming even when
 * posture did not lean — written to inform, not to condemn.
 */
export function arcFraming({
  status,
  arc,
  tribeName,
}: {
  status: TribeStatus;
  arc: ArcPosition;
  tribeName: string;
}): string | null {
  if (status === "active") {
    switch (arc) {
      case "integrated":
        return `Your answers place ${tribeName} toward the integrated end of its arc — the gift showing up in its matured form.`;
      case "active-shadow":
        return `Your answers lean toward ${tribeName}'s shadow side. Read that as an invitation, not an indictment: the same wiring matures as it moves toward its oil.`;
      case "mixed":
        return `Your answers sit mid-arc for ${tribeName} — both the gift and its shadow are live.`;
      case "neutral":
        return null;
    }
  }

  const label = STATUS_PHRASE[status];
  switch (arc) {
    case "integrated":
      return `${tribeName} carries a ${label} history in the biblical arc, but your answers place you on its redeemed side. Read this as the integrated form of the pattern — the wiring turned toward its oil, not the fall that named the warning.`;
    case "active-shadow":
      return `${tribeName} carries a ${label} history, and your answers lean toward the unredeemed edge of its arc. Take this as a caution, not a verdict: the fall-line is live enough to name, and the way through is the tribe's oil rather than suppressing the gift.`;
    case "mixed":
      return `${tribeName} carries a ${label} history. Your answers sit mid-arc — both its gift and its fall are live — and the movement this instrument points to is toward the integrated end, where the same wiring is redeemed.`;
    case "neutral":
      return `${tribeName} carries a ${label} history in the biblical arc. Your answers did not lean the reading either way; the status describes the tribe's story, never a verdict on you.`;
  }
}
