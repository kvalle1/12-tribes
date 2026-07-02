import "server-only";

import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import type { MarkerDelta, ScoreTraceEntry, StrengthProfile } from "./types";

/**
 * The Interview scoring engine (slice #16) — pure, deterministic, LLM-free.
 *
 * Given the current Strength Profile and the cited Marker deltas the agent read
 * from one answer, it folds those deltas into a new profile and emits a score
 * trace. All the rules that make the instrument defensible live here, isolated
 * from the model and the database so they can be unit-tested directly:
 *
 * - **Constrained to catalogued Markers (ADR-0003).** A delta scores only if its
 *   `markerId` resolves in the catalog AND its `tribeSlug` matches that Marker's
 *   own tribe. The agent cannot invent a Marker or misattribute one to score.
 * - **Additive; never lowers strength (ADR-0004).** Shadow and fall-line Markers
 *   are evidence a person *is* a tribe, not against it. A delta is clamped to
 *   [0,1] before it contributes, so a negative delta can never pull a tribe down.
 * - **Weighted by the Marker (ADR-0010).** The contribution is `delta × weight`,
 *   so bias-resistant shadow/fall-line Markers count for more than surface
 *   strengths, exactly as authored.
 *
 * `server-only` keeps the engine (and the catalog it reads) off the client — no
 * scoring logic reaches the browser (ADR-0009).
 */

export interface ScoringResult {
  /** A new profile with the cited deltas folded in (the input is never mutated). */
  profile: StrengthProfile;
  /** One entry per applied delta, tying the answer to the Marker and its contribution. */
  trace: ScoreTraceEntry[];
}

/** A delta is a 0–1 match strength; anything outside that (or NaN) is clamped in. */
function clampDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  if (delta < 0) return 0;
  if (delta > 1) return 1;
  return delta;
}

/**
 * Fold the cited Marker deltas from one answer into the profile, returning a new
 * profile and the trace of what was applied. Deltas that cite an unknown Marker,
 * disagree with the Marker's tribe, or clamp to zero contribute nothing and leave
 * no trace — scoring stays constrained to real, cited Markers.
 */
export function applyScoring(
  profile: StrengthProfile,
  answer: string,
  deltas: readonly MarkerDelta[],
): ScoringResult {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const cited of deltas) {
    const marker = getMarkerById(cited.markerId);
    if (!marker) continue; // ADR-0003: only catalogued Markers may score.
    if (marker.tribeSlug !== cited.tribeSlug) continue; // tribe must match the Marker.

    const delta = clampDelta(cited.delta); // ADR-0004: additive only, never subtracts.
    if (delta === 0) continue;

    const contribution = delta * marker.weight;
    next[marker.tribeSlug] = (next[marker.tribeSlug] ?? 0) + contribution;

    trace.push({
      answer,
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta,
      contribution,
    });
  }

  return { profile: next, trace };
}

/**
 * Project the raw profile onto display percentages — each tribe's share of the
 * total strength — for the result view (ADR-0002). Returns a fresh map; the
 * underlying independent scores in `profile` are left untouched. With no strength
 * accumulated yet, every tribe reads 0 rather than dividing by zero.
 */
export function toPercentages(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce((sum, value) => sum + value, 0);
  const percentages: Record<string, number> = {};
  for (const slug of Object.keys(profile)) {
    percentages[slug] = total > 0 ? ((profile[slug] ?? 0) / total) * 100 : 0;
  }
  return percentages;
}

export interface RankedTribe {
  slug: string;
  name: string;
  /** Raw independent strength for this tribe. */
  score: number;
  /** Share of total strength, 0–100 (ADR-0002). */
  percent: number;
}

/**
 * The profile as a ranked list for the result view — highest raw score first,
 * every tribe present, ties broken by name for a stable order.
 */
export function rankedProfile(profile: StrengthProfile): RankedTribe[] {
  const percentages = toPercentages(profile);
  const nameBySlug = new Map(tribes.map((tribe) => [tribe.slug, tribe.name]));

  return Object.keys(profile)
    .map((slug) => ({
      slug,
      name: nameBySlug.get(slug) ?? slug,
      score: profile[slug] ?? 0,
      percent: percentages[slug] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
