import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import {
  applyDeltas,
  deriveInterviewResult,
  deriveRanking,
  emptyStrengthProfile,
  toDisplayShares,
} from "./scoring";
import type { ScoredDelta } from "./types";

/**
 * Real Marker ids from the authored catalog, with their known weights
 * (strength=1, oil=2, shadow=2, fallLine=3). Read back through `getMarkerById`
 * so these stay honest if the catalog's weights ever change.
 */
const JUDAH_STRENGTH = "judah-strength-front"; // strength, weight 1
const JUDAH_SHADOW = "judah-shadow-insignificance"; // shadow, weight 2
const JUDAH_FALL = "judah-fall-power"; // fallLine, weight 3
const LEVI_STRENGTH = "levi-strength-guard"; // strength, weight 1

function weightOf(id: string): number {
  const marker = getMarkerById(id);
  if (!marker) throw new Error(`test fixture references missing marker: ${id}`);
  return marker.weight;
}

describe("applyDeltas", () => {
  it("scales a cited delta by the catalogued Marker's weight", () => {
    const { profile } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1 },
    ]);
    expect(profile.judah).toBe(weightOf(JUDAH_STRENGTH) * 1);
  });

  it("routes to the catalog's tribe/weight, not the agent's echoed claim", () => {
    // Correct id, but the agent omits the echo entirely: the catalog fills it in.
    const { profile, trace } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: JUDAH_STRENGTH, tribeSlug: "", type: "strength", delta: 0.5 },
    ]);
    expect(profile.judah).toBeCloseTo(weightOf(JUDAH_STRENGTH) * 0.5);
    expect(trace[0].tribeSlug).toBe("judah");
    expect(trace[0].type).toBe("strength");
  });

  it("treats shadow and fall-line deltas as additive to strength (never a penalty)", () => {
    const base = emptyStrengthProfile();
    base.judah = 5;
    const { profile } = applyDeltas(base, 1, [
      { markerId: JUDAH_SHADOW, tribeSlug: "judah", type: "shadow", delta: 1 },
      { markerId: JUDAH_FALL, tribeSlug: "judah", type: "fallLine", delta: 1 },
    ]);
    // 5 + shadow(weight 2) + fallLine(weight 3) = 10 — strictly greater, never lower.
    expect(profile.judah).toBe(5 + weightOf(JUDAH_SHADOW) + weightOf(JUDAH_FALL));
    expect(profile.judah).toBeGreaterThan(base.judah);
  });

  it("clamps delta to [0,1]: a negative delta adds nothing and leaves strength unchanged", () => {
    const base = emptyStrengthProfile();
    base.judah = 3;
    const { profile, trace } = applyDeltas(base, 0, [
      { markerId: JUDAH_SHADOW, tribeSlug: "judah", type: "shadow", delta: -5 },
    ]);
    expect(profile.judah).toBe(3); // unchanged, not reduced
    expect(trace).toHaveLength(0);
  });

  it("clamps a delta above 1 down to a full-weight contribution", () => {
    const { profile } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: JUDAH_FALL, tribeSlug: "judah", type: "fallLine", delta: 99 },
    ]);
    expect(profile.judah).toBe(weightOf(JUDAH_FALL)); // weight × 1
  });

  it("drops an unknown Marker id (cite-only)", () => {
    const { profile, trace } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: "not-a-real-marker", tribeSlug: "judah", type: "strength", delta: 1 },
    ]);
    expect(trace).toHaveLength(0);
    expect(Object.values(profile).every((v) => v === 0)).toBe(true);
  });

  it("drops a mis-cited delta whose echoed tribe disagrees with the catalog", () => {
    const { profile, trace } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: JUDAH_STRENGTH, tribeSlug: "levi", type: "strength", delta: 1 },
    ]);
    expect(trace).toHaveLength(0);
    expect(profile.judah).toBe(0);
    expect(profile.levi).toBe(0);
  });

  it("drops a mis-cited delta whose echoed type disagrees with the catalog", () => {
    const { trace } = applyDeltas(emptyStrengthProfile(), 0, [
      { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "fallLine", delta: 1 },
    ]);
    expect(trace).toHaveLength(0);
  });

  it("keeps a full trace back to the answer and Marker for every applied delta", () => {
    const deltas: ScoredDelta[] = [
      { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "neutral" },
      { markerId: LEVI_STRENGTH, tribeSlug: "levi", type: "strength", delta: 0.5, postureSignal: "integrated" },
    ];
    const { trace } = applyDeltas(emptyStrengthProfile(), 3, deltas);
    expect(trace).toHaveLength(2);
    expect(trace[0]).toEqual({
      turnIndex: 3,
      markerId: JUDAH_STRENGTH,
      tribeSlug: "judah",
      type: "strength",
      contribution: weightOf(JUDAH_STRENGTH) * 1,
      postureSignal: "neutral",
    });
    expect(trace[1].markerId).toBe(LEVI_STRENGTH);
    expect(trace[1].turnIndex).toBe(3);
    expect(trace[1].postureSignal).toBe("integrated");
  });

  it("does not mutate the input profile", () => {
    const base = emptyStrengthProfile();
    const snapshot = { ...base };
    applyDeltas(base, 0, [
      { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1 },
    ]);
    expect(base).toEqual(snapshot);
  });
});

describe("toDisplayShares", () => {
  it("normalizes to percentages that sum to 100 while keeping raw scores independent", () => {
    const profile = emptyStrengthProfile();
    profile.judah = 3;
    profile.levi = 1;
    const shares = toDisplayShares(profile);
    const total = shares.reduce((sum, t) => sum + t.share, 0);
    expect(total).toBeCloseTo(100);

    const judah = shares.find((t) => t.slug === "judah")!;
    const levi = shares.find((t) => t.slug === "levi")!;
    expect(judah.score).toBe(3); // raw score preserved, not normalized
    expect(levi.score).toBe(1);
    expect(judah.share).toBeCloseTo(75);
    expect(levi.share).toBeCloseTo(25);
  });

  it("returns all-zero shares for an empty profile without dividing by zero", () => {
    const shares = toDisplayShares(emptyStrengthProfile());
    expect(shares).toHaveLength(tribes.length);
    expect(shares.every((t) => t.share === 0 && t.score === 0)).toBe(true);
  });
});

describe("deriveRanking", () => {
  it("orders tribes by strength, highest first, with a top-relative fill fraction", () => {
    const profile = emptyStrengthProfile();
    profile.levi = 4;
    profile.judah = 2;
    const ranked = deriveRanking(profile);
    expect(ranked[0].slug).toBe("levi");
    expect(ranked[0].relative).toBe(1);
    expect(ranked[1].slug).toBe("judah");
    expect(ranked[1].relative).toBeCloseTo(0.5);
  });

  it("breaks ties by canonical tribe order deterministically", () => {
    const profile = emptyStrengthProfile();
    profile.judah = 2;
    profile.levi = 2;
    const ranked = deriveRanking(profile).filter((t) => t.score === 2).map((t) => t.slug);
    const canonical = tribes.filter((t) => ["judah", "levi"].includes(t.slug)).map((t) => t.slug);
    expect(ranked).toEqual(canonical);
  });
});

describe("deriveInterviewResult", () => {
  it("returns a full 12-tribe ranking", () => {
    const result = deriveInterviewResult(emptyStrengthProfile());
    expect(result.ranking).toHaveLength(tribes.length);
  });
});
