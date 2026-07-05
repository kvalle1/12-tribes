import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { getMarkerById, markerCatalog, type Marker } from "./markers";
import type { ScoredDelta } from "./types";
import {
  applyDeltas,
  deriveRanking,
  emptyStrengthProfile,
  toDisplayShares,
} from "./scoring";

/** A cited delta for a real Marker id, defaulting tribeSlug/type from the catalog. */
function deltaFor(markerId: string, delta: number, overrides: Partial<ScoredDelta> = {}): ScoredDelta {
  const marker = getMarkerById(markerId)!;
  return {
    markerId,
    tribeSlug: marker.tribeSlug,
    type: marker.type,
    delta,
    postureSignal: 0,
    ...overrides,
  };
}

describe("emptyStrengthProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyStrengthProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) expect(profile[tribe.slug]).toBe(0);
  });
});

describe("applyDeltas — additive strength", () => {
  it("folds weight × delta into the cited tribe", () => {
    const marker = getMarkerById("judah-strength-front")!; // weight 1
    const { profile } = applyDeltas(emptyStrengthProfile(), [deltaFor(marker.id, 1)], 0);
    expect(profile.judah).toBe(marker.weight * 1);
  });

  it("does not mutate the input profile", () => {
    const before = emptyStrengthProfile();
    applyDeltas(before, [deltaFor("judah-strength-front", 1)], 0);
    expect(before.judah).toBe(0);
  });

  it("accumulates across multiple deltas for the same tribe", () => {
    const { profile } = applyDeltas(
      emptyStrengthProfile(),
      [deltaFor("judah-strength-front", 1), deltaFor("judah-oil-responsibility", 0.5)],
      0,
    );
    const front = getMarkerById("judah-strength-front")!;
    const oil = getMarkerById("judah-oil-responsibility")!;
    expect(profile.judah).toBeCloseTo(front.weight * 1 + oil.weight * 0.5);
  });

  it("treats shadow and fall-line as additive — they never lower strength (ADR-0004)", () => {
    const start = { ...emptyStrengthProfile(), judah: 5 };
    const shadow = getMarkerById("judah-shadow-insignificance")!; // type: shadow
    const fall = getMarkerById("judah-fall-power")!; // type: fallLine
    const { profile } = applyDeltas(start, [deltaFor(shadow.id, 1), deltaFor(fall.id, 1)], 1);
    expect(shadow.type).toBe("shadow");
    expect(fall.type).toBe("fallLine");
    expect(profile.judah).toBe(5 + shadow.weight + fall.weight);
    expect(profile.judah).toBeGreaterThan(5);
  });

  it("clamps a negative delta to zero contribution (never subtracts)", () => {
    const start = { ...emptyStrengthProfile(), judah: 3 };
    const { profile, trace } = applyDeltas(start, [deltaFor("judah-shadow-insignificance", -2)], 0);
    expect(profile.judah).toBe(3);
    expect(trace).toHaveLength(0); // zero contribution → no trace
  });

  it("clamps a delta above 1 down to 1", () => {
    const marker = getMarkerById("levi-strength-guard")!;
    const { profile } = applyDeltas(emptyStrengthProfile(), [deltaFor(marker.id, 4)], 0);
    expect(profile.levi).toBe(marker.weight * 1);
  });

  it("counts a repeated Marker citation once per Turn (no double-counting)", () => {
    const marker = getMarkerById("judah-strength-front")!;
    const { profile, trace } = applyDeltas(
      emptyStrengthProfile(),
      [deltaFor(marker.id, 1), deltaFor(marker.id, 1)],
      0,
    );
    // One piece of evidence, cited twice, must not inflate the score.
    expect(profile.judah).toBe(marker.weight * 1);
    expect(trace).toHaveLength(1);
  });
});

describe("applyDeltas — cite-only validation (ADR-0003)", () => {
  it("drops a delta whose markerId is not in the catalog", () => {
    const { profile, trace } = applyDeltas(
      emptyStrengthProfile(),
      [{ markerId: "not-a-real-marker", tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0 }],
      0,
    );
    expect(trace).toHaveLength(0);
    expect(Object.values(profile).every((v) => v === 0)).toBe(true);
  });

  it("drops a delta that mis-cites the tribe for a real Marker", () => {
    // judah-strength-front belongs to judah; claiming it scores levi is a mis-cite.
    const { profile, trace } = applyDeltas(
      emptyStrengthProfile(),
      [deltaFor("judah-strength-front", 1, { tribeSlug: "levi" })],
      0,
    );
    expect(trace).toHaveLength(0);
    expect(profile.judah).toBe(0);
    expect(profile.levi).toBe(0);
  });

  it("scores toward the Marker's real tribe/weight, not the agent-supplied ones", () => {
    // Agent lies about the weight-bearing fields; catalog is authoritative.
    const marker = getMarkerById("judah-fall-power")!; // weight 3, type fallLine
    const lying: ScoredDelta = {
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: "strength", // wrong type
      delta: 1,
      postureSignal: 0,
    };
    const { profile, trace } = applyDeltas(emptyStrengthProfile(), [lying], 2);
    expect(profile.judah).toBe(marker.weight); // catalog weight, not 1
    expect(trace[0].type).toBe(marker.type); // catalog type, not the claimed one
    expect(trace[0].weight).toBe(marker.weight);
  });
});

describe("applyDeltas — trace (ADR-0003)", () => {
  it("records a trace entry per applied delta linking answer, marker, and contribution", () => {
    const { trace } = applyDeltas(
      emptyStrengthProfile(),
      [deltaFor("issachar-strength-timing", 0.8)],
      3,
    );
    const marker = getMarkerById("issachar-strength-timing")!;
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      turnIndex: 3,
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      delta: 0.8,
      weight: marker.weight,
    });
    expect(trace[0].contribution).toBeCloseTo(marker.weight * 0.8);
  });
});

describe("toDisplayShares (ADR-0002)", () => {
  it("normalizes to percentages that sum to 100 while scores stay independent", () => {
    const profile = { ...emptyStrengthProfile(), judah: 3, levi: 1 };
    const shares = toDisplayShares(profile);
    const total = Object.values(shares).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100);
    expect(shares.judah).toBeCloseTo(75);
    expect(shares.levi).toBeCloseTo(25);
    // Underlying scores are untouched by normalization.
    expect(profile.judah).toBe(3);
  });

  it("returns all zeros for an all-zero profile without dividing by zero", () => {
    const shares = toDisplayShares(emptyStrengthProfile());
    expect(Object.values(shares).every((v) => v === 0)).toBe(true);
  });
});

describe("deriveRanking", () => {
  it("ranks all 12 tribes by score descending with display shares", () => {
    const profile = { ...emptyStrengthProfile(), levi: 4, judah: 2 };
    const ranking = deriveRanking(profile);
    expect(ranking).toHaveLength(tribes.length);
    expect(ranking[0].slug).toBe("levi");
    expect(ranking[1].slug).toBe("judah");
    expect(ranking[0].share).toBeCloseTo((4 / 6) * 100);
  });

  it("breaks ties by canonical tribe order deterministically", () => {
    const ranking = deriveRanking(emptyStrengthProfile());
    // All zero → canonical order preserved (tribes are number-sorted).
    expect(ranking.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("catalog is well-formed for the scorer", () => {
  it("every Marker resolves to a real tribe slug (guards cite-only integrity)", () => {
    const slugs = new Set(tribes.map((t) => t.slug));
    for (const marker of markerCatalog as readonly Marker[]) {
      expect(slugs.has(marker.tribeSlug)).toBe(true);
    }
  });
});
