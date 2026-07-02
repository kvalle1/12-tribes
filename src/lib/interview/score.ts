import "server-only";
import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import type {
  AppliedDelta,
  MarkerDelta,
  StrengthProfile,
  TraceEntry,
} from "./types";

/**
 * Pure scoring engine for the AI Agent Interview (issue #16, ADRs 0002/0003/0004).
 *
 * The agent interprets an answer and returns per-tribe **Marker deltas**; this
 * engine folds them into a running Strength Profile. Two rules make it
 * defensible and reproducible:
 *
 * - **Marker-constrained (ADR-0003).** Every delta must cite a real Marker id.
 *   The engine looks the Marker up and scores from the *catalogued* tribe, type,
 *   and weight — never the agent's assertion — so the same answer scores the
 *   same way run to run, and a mis-attributed citation can't move the wrong
 *   tribe.
 * - **Additive only (ADR-0004).** Strength never decreases. Shadow and
 *   fall-line evidence resonate *toward* a tribe (a person doesn't build hard-won
 *   resistance to a tendency that was never theirs), so their deltas add to
 *   strength like any other. Intensity is clamped to [0, 1], so a contribution
 *   is always ≥ 0.
 *
 * `server-only` keeps the engine and the Marker Catalog it reads off the client
 * (ADR-0009 trust boundary). Display normalization (ADR-0002) is cosmetic — the
 * underlying per-tribe scores stay independent and must not be read as a
 * probability distribution.
 */

/** A tribe's strength, both as the raw independent score and a display share. */
export interface TribeStrength {
  slug: string;
  name: string;
  /** Independent accumulated strength (not comparable as a probability). */
  raw: number;
  /** Display share in [0, 100]; shares across all tribes sum to ~100 (ADR-0002). */
  percentage: number;
}

/** A fresh, zeroed strength profile covering all 12 tribes. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** Clamp a raw agent intensity into the scorable [0, 1] range. */
function clampIntensity(delta: number): number {
  if (!Number.isFinite(delta) || delta < 0) return 0;
  if (delta > 1) return 1;
  return delta;
}

/**
 * Resolve agent-cited deltas against the Marker Catalog. Deltas citing an
 * unknown Marker id are dropped (the agent may only score via real Markers);
 * the survivors carry the catalogued tribe/type/weight and a clamped intensity.
 */
export function resolveDeltas(deltas: MarkerDelta[]): AppliedDelta[] {
  const applied: AppliedDelta[] = [];
  for (const d of deltas) {
    const marker = getMarkerById(d.markerId);
    if (!marker) continue; // uncatalogued citation — reject, don't score

    const intensity = clampIntensity(d.delta);
    applied.push({
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      weight: marker.weight,
      intensity,
      contribution: intensity * marker.weight,
      postureSignal: d.postureSignal,
    });
  }
  return applied;
}

/**
 * Fold one scored answer into a Session's profile and trace, returning new
 * values (no mutation). Contributions are additive, so strength only ever rises.
 */
export function scoreTurn(
  base: { profile: StrengthProfile; trace: TraceEntry[] },
  turn: { question: string; answer: string; deltas: MarkerDelta[] },
): { profile: StrengthProfile; trace: TraceEntry[] } {
  const applied = resolveDeltas(turn.deltas);

  const profile: StrengthProfile = { ...base.profile };
  for (const a of applied) {
    profile[a.tribeSlug] = (profile[a.tribeSlug] ?? 0) + a.contribution;
  }

  const trace: TraceEntry[] = [
    ...base.trace,
    { question: turn.question, answer: turn.answer, applied },
  ];

  return { profile, trace };
}

/**
 * Rank all 12 tribes by raw strength (highest first) and attach display
 * percentages that sum to ~100. Shares are cosmetic; the raw scores remain the
 * independent source of truth (ADR-0002). An all-zero profile yields all-zero
 * percentages rather than NaN.
 */
export function rankedProfile(profile: StrengthProfile): TribeStrength[] {
  const total = tribes.reduce((sum, t) => sum + (profile[t.slug] ?? 0), 0);

  return tribes
    .map((t) => {
      const raw = profile[t.slug] ?? 0;
      return {
        slug: t.slug,
        name: t.name,
        raw,
        percentage: total > 0 ? (raw / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.raw - a.raw);
}
