import "server-only";

import { oilMarkerForTribe } from "./markers";
import type {
  MarkerDelta,
  PostureProfile,
  PostureReading,
  PostureTally,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — pure, deterministic functions that
 * fold validated Marker deltas into a Strength Profile, accumulate the Posture
 * axis alongside it, and normalize for display. The only catalog it touches is
 * the oil-Marker lookup used to route a matured fall-line (ADR-0004), and that
 * lookup is injectable so the core folding logic stays testable in isolation.
 * `agent.ts` turns an answer into validated, catalog-bounded deltas, and this
 * module applies them. Keeping it pure is what makes the instrument's scoring
 * testable and reproducible run-to-run.
 *
 * `server-only` keeps the scoring logic off the client (ADR-0009): a Strength
 * Profile is an authoritative result, never something the client computes.
 */

/**
 * Fold a Turn's validated deltas into the running profile, returning a new
 * profile (no mutation) and the trace entries for the applied deltas.
 *
 * The underlying scores are independent per-tribe tallies (ADR-0002): a delta
 * accumulates onto its tribe and touches no other. Two rules protect the
 * strength signal:
 *
 *  - **Additive, never subtractive (ADR-0004).** Every contribution raises
 *    strength or leaves it unchanged. A shadow or fall-line Marker fires on
 *    *resonance with the theme*, so maturity around a fall-line is still
 *    evidence *of* the tribe — a negative delta (anyone "fixing" the confound
 *    by subtracting) is clamped to zero rather than lowering strength.
 *  - **Known tribes only.** A delta whose `tribeSlug` is not already a key of
 *    the profile is a validation miss; it is dropped rather than inventing a
 *    new tribe.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    trace.push({
      turnIndex,
      markerId: delta.markerId,
      tribeSlug: delta.tribeSlug,
      type: delta.type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * Project the independent per-tribe scores onto display percentages that sum to
 * 100. This is cosmetic (ADR-0002): the scores are not a probability
 * distribution and remain independent underneath — normalization is only for
 * rendering shares. When nothing has scored yet every tribe is 0%, and the
 * total of zero is handled without dividing by zero.
 */
export function normalize(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce((sum, score) => sum + score, 0);
  const pct: Record<string, number> = {};
  for (const [slug, score] of Object.entries(profile)) {
    pct[slug] = total === 0 ? 0 : (score / total) * 100;
  }
  return pct;
}

/**
 * Posture signals ordered by precedence when two contributions to one Marker are
 * merged: a posture-bearing reading outranks `neutral`, and `integrated` (the
 * matured-fall-line intent) outranks `active-shadow`.
 */
const POSTURE_PRECEDENCE: Record<MarkerDelta["postureSignal"], number> = {
  integrated: 2,
  "active-shadow": 1,
  neutral: 0,
};

/**
 * Route a matured fall-line to the tribe's oil Marker (ADR-0004). A fall-line
 * Marker fires on *resonance with the theme*, so a participant who has matured
 * past the tendency still resonates with it — the agent tags that answer
 * `postureSignal: "integrated"`. Such a contribution is re-attributed to the
 * tribe's `oil` Marker, which cross-confirms the attribution via a different
 * Marker type, while the tribe, the delta magnitude, and the posture signal are
 * all preserved. Every other delta passes through untouched.
 *
 * Only fall-lines are routed: ADR-0004 scopes the oil cross-confirmation to the
 * fall-line specifically. A matured `shadow` still contributes its posture via
 * `accumulatePosture`; it is simply not re-attributed.
 *
 * **Strength is never lowered (ADR-0004).** The re-attributed delta keeps its
 * full magnitude even though the oil Marker's own weight is lower than the
 * fall-line's — ADR-0004's "never lowers strength" governs here over ADR-0003's
 * per-Marker weight cap, which has already bounded the incoming fall-line delta.
 * For the same reason, if a Turn cites both an integrated fall-line and the
 * tribe's oil Marker directly, the two now-colliding oil contributions are
 * *summed* (never re-capped) into one entry, so the Turn carries a single,
 * deduplicated oil delta rather than two with the same id.
 *
 * The oil-Marker resolver is injectable (defaulting to the real catalog) so the
 * routing rule can be unit-tested without the catalog, and so a tribe missing an
 * oil Marker degrades to leaving the delta as-is rather than throwing.
 */
export function routeMaturedFallLines(
  deltas: readonly MarkerDelta[],
  oilMarkerIdFor: (slug: string) => string | undefined = (slug) =>
    oilMarkerForTribe(slug)?.id,
): MarkerDelta[] {
  const routed = deltas.map((delta): MarkerDelta => {
    if (delta.type !== "fallLine" || delta.postureSignal !== "integrated") {
      return delta;
    }
    const oilMarkerId = oilMarkerIdFor(delta.tribeSlug);
    if (!oilMarkerId) return delta;
    return { ...delta, markerId: oilMarkerId, type: "oil" };
  });

  // Collapse any entries that now share a Marker id (a routed fall-line landing
  // on the same oil Marker the Turn also cited directly). Sum strength to honour
  // ADR-0004, and keep the strongest posture signal.
  const byMarker = new Map<string, MarkerDelta>();
  for (const delta of routed) {
    const existing = byMarker.get(delta.markerId);
    if (!existing) {
      byMarker.set(delta.markerId, { ...delta });
      continue;
    }
    existing.delta += delta.delta;
    if (POSTURE_PRECEDENCE[delta.postureSignal] > POSTURE_PRECEDENCE[existing.postureSignal]) {
      existing.postureSignal = delta.postureSignal;
    }
  }
  return [...byMarker.values()];
}

/**
 * Accumulate the Posture axis per tribe from the score trace (ADR-0004). Posture
 * is derived from the persisted trace rather than stored separately — the same
 * pattern `profileHistory` uses for strength — so every posture-bearing answer
 * (its `postureSignal` and the strength weight behind it) is replayable and no
 * extra state has to be kept in sync. `neutral` entries contribute to neither
 * end; `integrated` and `active-shadow` entries accumulate the applied delta on
 * their respective side. Posture is orthogonal to strength and never alters it.
 */
export function accumulatePosture(
  trace: readonly ScoreTraceEntry[],
): PostureProfile {
  const posture: PostureProfile = {};
  for (const entry of trace) {
    if (entry.postureSignal === "neutral") continue;
    const tally = (posture[entry.tribeSlug] ??= {
      integrated: 0,
      activeShadow: 0,
    });
    if (entry.postureSignal === "integrated") {
      tally.integrated += entry.delta;
    } else {
      tally.activeShadow += entry.delta;
    }
  }
  return posture;
}

/**
 * A tribe counts as settled toward one end of its arc once that end holds at
 * least this share of the lead over the other; inside the band it reads `mixed`.
 */
export const POSTURE_BAND = 0.25;

/**
 * Read a Posture tally as an arc position in [-1, +1] and a banded label
 * (ADR-0004). `unknown` when there is no posture-bearing evidence yet.
 */
export function postureReading(tally: PostureTally | undefined): PostureReading {
  const integrated = tally?.integrated ?? 0;
  const activeShadow = tally?.activeShadow ?? 0;
  const total = integrated + activeShadow;
  if (total <= 0) return { position: null, label: "unknown" };

  const position = (integrated - activeShadow) / total;
  const label =
    position >= POSTURE_BAND
      ? "integrated"
      : position <= -POSTURE_BAND
        ? "active-shadow"
        : "mixed";
  return { position, label };
}

/**
 * Per-tribe Posture readings derived from the score trace — the display-ready
 * form consumed by the result (ADR-0004). Only tribes with posture-bearing
 * evidence appear; a tribe scored on strength alone is simply absent.
 */
export function posturesFromTrace(
  trace: readonly ScoreTraceEntry[],
): Record<string, PostureReading> {
  const posture = accumulatePosture(trace);
  const readings: Record<string, PostureReading> = {};
  for (const [slug, tally] of Object.entries(posture)) {
    readings[slug] = postureReading(tally);
  }
  return readings;
}
