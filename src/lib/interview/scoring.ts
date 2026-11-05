import "server-only";

import type {
  ArcPosition,
  MarkerDelta,
  PostureProfile,
  PostureTally,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — pure, deterministic functions that
 * fold validated Marker deltas into a Strength Profile and normalize it for
 * display. It holds no catalog and makes no model call: `agent.ts` turns an
 * answer into validated, catalog-bounded deltas, and this module applies them.
 * Keeping it pure is what makes the instrument's scoring testable and
 * reproducible run-to-run.
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
 *
 * Matured fall-line routing (ADR-0004): a fall-line Marker scored `integrated`
 * means the participant resonates with the theme but has *matured past* the
 * dysfunction, so the evidence is re-attributed to the tribe's `oil` Marker in
 * the trace — the oil (integrated) end of the arc, not the fall line. The
 * strength contribution is untouched (same tribe, same amount): routing shifts
 * the Posture reading, never the strength. The oil-Marker lookup is injected
 * (`oilMarkerFor`) so this module stays pure and catalog-free; without it, or
 * when a tribe has no oil Marker, the fall-line attribution is kept as-is.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  oilMarkerFor?: (tribeSlug: string) => string | undefined,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    // Route a matured fall-line to the tribe's oil Marker (strength unchanged).
    let markerId = delta.markerId;
    let type = delta.type;
    if (delta.type === "fallLine" && delta.postureSignal === "integrated") {
      const oilId = oilMarkerFor?.(delta.tribeSlug);
      if (oilId) {
        markerId = oilId;
        type = "oil";
      }
    }

    trace.push({
      turnIndex,
      markerId,
      tribeSlug: delta.tribeSlug,
      type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * Fold the score trace into a per-tribe Posture tally (slice 6, ADR-0004) — the
 * Posture axis accumulated alongside strength. Each posture-bearing entry adds
 * its weight to the `integrated` or `active-shadow` end of its tribe's arc;
 * `neutral` entries are not posture-bearing and are skipped, so a tribe with
 * only neutral evidence never appears. Derived from the authoritative trace (as
 * the Confidence evaluator derives its history), so no extra persisted state is
 * needed and a resumed Session re-derives the same Posture.
 */
export function aggregatePosture(trace: readonly ScoreTraceEntry[]): PostureProfile {
  const posture: PostureProfile = {};
  for (const entry of trace) {
    if (entry.postureSignal === "neutral") continue;
    const tally = (posture[entry.tribeSlug] ??= { activeShadow: 0, integrated: 0 });
    if (entry.postureSignal === "integrated") tally.integrated += entry.delta;
    else tally.activeShadow += entry.delta;
  }
  return posture;
}

/**
 * Read a tribe's place on its fall→oil arc from its Posture tally: `integrated`
 * when the oil end leads, `active-shadow` when the fall end leads, `mixed` when
 * both are present and even, and `unknown` when there is no posture-bearing
 * evidence (an absent tally included). This is the reading the result frames a
 * tribe with — cautionary at the shadow end, redemption at the oil end.
 */
export function arcPosition(tally: PostureTally | undefined): ArcPosition {
  if (!tally || (tally.activeShadow === 0 && tally.integrated === 0)) return "unknown";
  if (tally.integrated > tally.activeShadow) return "integrated";
  if (tally.activeShadow > tally.integrated) return "active-shadow";
  return "mixed";
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
