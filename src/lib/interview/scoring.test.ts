import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import {
  aggregatePosture,
  applyMarkerDeltas,
  attribution,
  type ScoringState,
} from "./scoring";
import { emptyProfile } from "./flow";
import type { MarkerDelta, ScoreTrace } from "./types";

// Real Marker ids from the catalog, spanning all four types.
const JUDAH_STRENGTH = "judah-strength-front"; // strength, weight 1
const JUDAH_FALL = "judah-fall-power"; //         fallLine, weight 3
const LEVI_SHADOW = "levi-shadow-legalism"; //    shadow,   weight 2
const LEVI_OIL = "levi-oil-access"; //            oil,      weight 2

function delta(overrides: Partial<MarkerDelta> & { markerId: string }): MarkerDelta {
  const marker = getMarkerById(overrides.markerId)!;
  return {
    markerId: marker.id,
    tribeSlug: marker.tribeSlug,
    type: marker.type,
    delta: marker.weight,
    postureSignal: "aware",
    ...overrides,
  };
}

const fresh = (): ScoringState => ({ profile: emptyProfile(), traces: [] });

describe("applyMarkerDeltas", () => {
  it("applies a cited strength delta to its tribe", () => {
    const next = applyMarkerDeltas(fresh(), 0, [delta({ markerId: JUDAH_STRENGTH, delta: 1 })]);
    expect(next.profile.judah).toBe(1);
  });

  it("treats shadow and fall-line deltas as additive — never lowering strength (ADR-0004)", () => {
    const start: ScoringState = { profile: { ...emptyProfile(), levi: 3 }, traces: [] };
    const next = applyMarkerDeltas(start, 0, [
      delta({ markerId: LEVI_SHADOW, delta: 2 }),
      delta({ markerId: JUDAH_FALL, delta: 3 }),
    ]);
    expect(next.profile.levi).toBe(5); // 3 + 2, raised not lowered
    expect(next.profile.judah).toBe(3); // fall-line adds strength
  });

  it("clamps a delta to the Marker's weight", () => {
    const next = applyMarkerDeltas(fresh(), 0, [delta({ markerId: JUDAH_STRENGTH, delta: 99 })]);
    expect(next.profile.judah).toBe(1); // judah-strength-front weight is 1
  });

  it("drops a delta whose Marker id is not in the catalog", () => {
    const next = applyMarkerDeltas(fresh(), 0, [
      { markerId: "made-up-marker", tribeSlug: "judah", type: "strength", delta: 5, postureSignal: "aware" },
    ]);
    expect(next.profile.judah).toBe(0);
    expect(next.traces).toHaveLength(0);
  });

  it("drops a delta whose cited tribe or type disagrees with the catalog (ADR-0003)", () => {
    const wrongTribe = applyMarkerDeltas(fresh(), 0, [
      delta({ markerId: JUDAH_STRENGTH, tribeSlug: "levi", delta: 1 }),
    ]);
    const wrongType = applyMarkerDeltas(fresh(), 0, [
      delta({ markerId: JUDAH_STRENGTH, type: "shadow", delta: 1 }),
    ]);
    expect(wrongTribe.traces).toHaveLength(0);
    expect(wrongType.traces).toHaveLength(0);
  });

  it("drops non-positive and non-finite deltas", () => {
    const next = applyMarkerDeltas(fresh(), 0, [
      delta({ markerId: JUDAH_STRENGTH, delta: 0 }),
      delta({ markerId: LEVI_OIL, delta: -2 }),
      delta({ markerId: JUDAH_FALL, delta: Number.NaN }),
    ]);
    expect(next.traces).toHaveLength(0);
    for (const tribe of tribes) expect(next.profile[tribe.slug]).toBe(0);
  });

  it("records a trace back to the answer (turnIndex) and Marker for every applied delta", () => {
    const next = applyMarkerDeltas(fresh(), 2, [
      delta({ markerId: JUDAH_STRENGTH, delta: 1, postureSignal: "integrated" }),
    ]);
    expect(next.traces).toEqual<ScoreTrace[]>([
      {
        turnIndex: 2,
        markerId: JUDAH_STRENGTH,
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
        postureSignal: "integrated",
      },
    ]);
  });

  it("does not mutate the input state", () => {
    const before = fresh();
    applyMarkerDeltas(before, 0, [delta({ markerId: JUDAH_STRENGTH, delta: 1 })]);
    expect(before.profile.judah).toBe(0);
    expect(before.traces).toEqual([]);
  });
});

describe("attribution", () => {
  it("normalizes independent scores to percentages that sum to ~100", () => {
    const profile = { ...emptyProfile(), judah: 3, levi: 1 };
    const shares = attribution(profile);
    expect(shares.judah).toBeCloseTo(75);
    expect(shares.levi).toBeCloseTo(25);
    const total = Object.values(shares).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100);
  });

  it("is all-zero before anything has scored", () => {
    const shares = attribution(emptyProfile());
    for (const tribe of tribes) expect(shares[tribe.slug]).toBe(0);
  });
});

describe("aggregatePosture", () => {
  it("reports each tribe's dominant posture signal", () => {
    const traces: ScoreTrace[] = [
      { turnIndex: 0, markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "active-shadow" },
      { turnIndex: 1, markerId: JUDAH_FALL, tribeSlug: "judah", type: "fallLine", delta: 3, postureSignal: "integrated" },
      { turnIndex: 2, markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "integrated" },
    ];
    expect(aggregatePosture(traces).judah).toBe("integrated");
  });

  it("omits tribes with no traces", () => {
    expect(aggregatePosture([])).toEqual({});
  });
});
