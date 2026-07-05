import "server-only";

import { tribes } from "@/lib/tribes";
import { markerCatalog, type Marker } from "./markers";
import type {
  RankedTribe,
  ScoredDelta,
  StrengthProfile,
  TraceEntry,
} from "./types";

/**
 * The Interview Scoring engine — pure and server-only (ADR-0009 trust boundary).
 *
 * The agent interprets an answer and returns cited Marker deltas; this module
 * folds them into the running Strength Profile. Three invariants make the
 * instrument defensible:
 *
 * 1. **Cite-only (ADR-0003).** A delta is applied only if its `markerId` resolves
 *    against the Marker Catalog *and* the cited `tribeSlug` matches that Marker's
 *    tribe. Unknown or mis-cited ids are dropped — the agent cannot invent
 *    rationale, and the tribe/weight come from the catalog, not the agent.
 * 2. **Additive, never subtractive (ADR-0004).** Every Marker type — including
 *    `shadow` and `fallLine` — is *evidence of that tribe's wiring*, so it only
 *    ever raises the tribe's strength. The contribution is
 *    `weight × clamp(delta, 0, 1)`, which is always ≥ 0.
 * 3. **Traceable (ADR-0003).** Each applied delta yields a `TraceEntry` linking
 *    the answer (by Turn index) → the Marker → the contribution, so a score can
 *    be inspected rather than taken on faith.
 *
 * Scores are kept independent and only normalized to display percentages on
 * demand (ADR-0002) — the underlying tribe scores are not a probability
 * distribution and must not be treated as mutually exclusive.
 */

/** A fresh, zeroed Strength Profile covering all 12 tribes, keyed by slug. */
export function emptyStrengthProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}

/** Clamp the agent's evidence strength into the scorable 0–1 range. */
function clampDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  if (delta < 0) return 0;
  if (delta > 1) return 1;
  return delta;
}

export interface ApplyDeltasResult {
  /** A new profile with the (valid) contributions folded in — input is not mutated. */
  profile: StrengthProfile;
  /** One entry per *applied* delta (dropped deltas produce no trace). */
  trace: TraceEntry[];
}

/**
 * Fold a Turn's cited deltas into `profile`, returning a new profile and the
 * trace of what was applied. Pure: `profile` is copied, not mutated. `turnIndex`
 * labels the trace so a later view can point back to the answer. `catalog` is
 * injectable so tests can validate against deliberately-broken catalogs; it
 * defaults to the authored Marker Catalog.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly ScoredDelta[],
  turnIndex: number,
  catalog: readonly Marker[] = markerCatalog,
): ApplyDeltasResult {
  const next: StrengthProfile = { ...profile };
  const trace: TraceEntry[] = [];
  const byId = new Map(catalog.map((m) => [m.id, m]));
  // One citation per Marker per Turn: a repeated (or hallucinated-duplicate)
  // citation must not double-count the same piece of evidence, which would
  // silently inflate a tribe's score past what one answer can support.
  const cited = new Set<string>();

  for (const delta of deltas) {
    const marker = byId.get(delta.markerId);
    // Cite-only: drop unknown ids and deltas whose cited tribe mis-matches the
    // Marker's real tribe. The catalog — not the agent — is authoritative.
    if (!marker) continue;
    if (delta.tribeSlug !== marker.tribeSlug) continue;
    if (cited.has(marker.id)) continue;

    const contribution = marker.weight * clampDelta(delta.delta);
    // Additive only: never let a contribution lower a tribe's strength.
    if (contribution <= 0) continue;

    cited.add(marker.id);
    next[marker.tribeSlug] = (next[marker.tribeSlug] ?? 0) + contribution;
    trace.push({
      turnIndex,
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: delta.delta,
      weight: marker.weight,
      contribution,
    });
  }

  return { profile: next, trace };
}

/**
 * Normalize a profile to display shares (percentages summing to ~100), purely
 * cosmetic (ADR-0002). An all-zero profile returns all zeros rather than
 * dividing by zero. Shares are not rounded, so they sum to exactly 100 when the
 * total is positive.
 */
export function toDisplayShares(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce((sum, v) => sum + v, 0);
  const shares: Record<string, number> = {};
  for (const [slug, score] of Object.entries(profile)) {
    shares[slug] = total > 0 ? (score / total) * 100 : 0;
  }
  return shares;
}

/**
 * Rank all 12 tribes by raw score (desc), attaching each tribe's display share.
 * Ties keep canonical (tribe `number`) order, so the ranking is deterministic.
 * Tribes absent from the profile score 0.
 */
export function deriveRanking(profile: StrengthProfile): RankedTribe[] {
  const shares = toDisplayShares(profile);
  return tribes
    .map((tribe) => ({
      slug: tribe.slug,
      name: tribe.name,
      score: profile[tribe.slug] ?? 0,
      share: shares[tribe.slug] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}
