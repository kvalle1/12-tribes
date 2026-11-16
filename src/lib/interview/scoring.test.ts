import { describe, expect, it } from "vitest";
import {
  accumulatePosture,
  applyDeltas,
  normalize,
  posturePosition,
} from "./scoring";
import type { MarkerDelta, ScoreTraceEntry } from "./types";

const d = (
  markerId: string,
  tribeSlug: string,
  type: MarkerDelta["type"],
  delta: number,
  postureSignal: MarkerDelta["postureSignal"] = "neutral",
): MarkerDelta => ({ markerId, tribeSlug, type, delta, postureSignal });

const te = (
  turnIndex: number,
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"],
): ScoreTraceEntry => ({ turnIndex, tribeSlug, type, delta, postureSignal, markerId: `${tribeSlug}-${type}` });

describe("applyDeltas", () => {
  it("adds a strength delta to the cited tribe", () => {
    const { profile } = applyDeltas({ judah: 0, levi: 0 }, [d("m1", "judah", "strength", 2)], 0);
    expect(profile.judah).toBe(2);
    expect(profile.levi).toBe(0);
  });

  it("accumulates multiple deltas onto the running profile", () => {
    const { profile } = applyDeltas(
      { judah: 3, levi: 1 },
      [d("m1", "judah", "strength", 2), d("m2", "levi", "oil", 1)],
      0,
    );
    expect(profile.judah).toBe(5);
    expect(profile.levi).toBe(2);
  });

  it("does not mutate the input profile", () => {
    const before = { judah: 0, levi: 0 };
    applyDeltas(before, [d("m1", "judah", "strength", 2)], 0);
    expect(before).toEqual({ judah: 0, levi: 0 });
  });

  it("treats a shadow delta as additive — it raises, never lowers, strength (ADR-0004)", () => {
    const { profile } = applyDeltas({ judah: 4 }, [d("m1", "judah", "shadow", 2)], 0);
    expect(profile.judah).toBe(6);
  });

  it("never lets a negative shadow delta lower strength (the matured-fall confound)", () => {
    const { profile } = applyDeltas({ judah: 4 }, [d("m1", "judah", "shadow", -3)], 0);
    expect(profile.judah).toBe(4);
  });

  it("never lets a negative fall-line delta lower strength", () => {
    const { profile } = applyDeltas({ simeon: 2 }, [d("m1", "simeon", "fallLine", -5)], 0);
    expect(profile.simeon).toBe(2);
  });

  it("records a trace entry per applied delta, tied to the Turn index and Marker", () => {
    // No oil Marker to route to, so the citation passes through unchanged —
    // matured-fall-line routing has its own tests below.
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      2,
      () => undefined,
    );
    expect(trace).toEqual([
      {
        turnIndex: 2,
        markerId: "judah-fall-power",
        tribeSlug: "judah",
        type: "fallLine",
        delta: 3,
        postureSignal: "integrated",
      },
    ]);
  });

  it("records the applied (clamped) delta in the trace, not the raw negative", () => {
    const { trace } = applyDeltas({ judah: 1 }, [d("m1", "judah", "shadow", -3)], 0);
    expect(trace[0].delta).toBe(0);
  });

  it("ignores a delta for a tribe not already in the profile shape", () => {
    // The running profile is seeded with all 12 tribes; a slug outside it is a
    // validation miss and must not silently introduce a new key.
    const { profile } = applyDeltas({ judah: 0 }, [d("m1", "unknown", "strength", 2)], 0);
    expect(profile).toEqual({ judah: 0 });
    expect(Object.keys(profile)).toEqual(["judah"]);
  });
});

describe("applyDeltas — matured fall-line routing (ADR-0004)", () => {
  const oilFor = (slug: string) => (slug === "judah" ? "judah-oil-x" : undefined);

  it("re-attributes a matured fall-line (integrated) to the tribe's oil Marker in the trace", () => {
    const { profile, trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      1,
      oilFor,
    );
    // Strength lands once, on the tribe, and is never lowered.
    expect(profile.judah).toBe(3);
    // The trace entry is routed to the oil Marker: same tribe/delta/posture, oil type.
    expect(trace).toEqual([
      {
        turnIndex: 1,
        markerId: "judah-oil-x",
        tribeSlug: "judah",
        type: "oil",
        delta: 3,
        postureSignal: "integrated",
      },
    ]);
  });

  it("preserves the trace→profile invariant: one entry, same delta (no double-count)", () => {
    const { profile, trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
      oilFor,
    );
    const summed = trace.reduce((sum, e) => sum + e.delta, 0);
    expect(summed).toBe(profile.judah);
  });

  it("does not route a fall-line that is still active-shadow", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "active-shadow")],
      0,
      oilFor,
    );
    expect(trace[0]).toMatchObject({ markerId: "judah-fall-power", type: "fallLine" });
  });

  it("keeps the original Marker when the tribe has no oil Marker to route to", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
      () => undefined,
    );
    expect(trace[0]).toMatchObject({ markerId: "judah-fall-power", type: "fallLine" });
  });

  it("routes against the real catalog by default (judah's oil Marker)", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
    );
    expect(trace[0].type).toBe("oil");
    expect(trace[0].markerId).toBe("judah-oil-responsibility");
  });

  it("only routes fall-line Markers, never an integrated strength or oil contribution", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-strength-front", "judah", "strength", 1, "integrated")],
      0,
      oilFor,
    );
    expect(trace[0]).toMatchObject({ markerId: "judah-strength-front", type: "strength" });
  });
});

describe("accumulatePosture", () => {
  it("tallies integrated and active-shadow evidence per tribe by delta, ignoring neutral", () => {
    const posture = accumulatePosture([
      te(0, "judah", "oil", 3, "integrated"),
      te(1, "judah", "shadow", 2, "active-shadow"),
      te(2, "judah", "strength", 1, "neutral"),
      te(3, "levi", "oil", 2, "integrated"),
    ]);
    expect(posture.judah).toEqual({ activeShadow: 2, integrated: 3 });
    expect(posture.levi).toEqual({ activeShadow: 0, integrated: 2 });
  });

  it("lists a tribe with only neutral evidence at zero on both ends", () => {
    const posture = accumulatePosture([te(0, "dan", "strength", 1, "neutral")]);
    expect(posture.dan).toEqual({ activeShadow: 0, integrated: 0 });
  });

  it("is empty for an empty trace", () => {
    expect(accumulatePosture([])).toEqual({});
  });
});

describe("posturePosition", () => {
  it("leans integrated when integrated evidence dominates", () => {
    const p = posturePosition({ activeShadow: 1, integrated: 3 });
    expect(p?.score).toBeCloseTo(0.5);
    expect(p?.arc).toBe("integrated");
  });

  it("leans active-shadow when shadow evidence dominates", () => {
    const p = posturePosition({ activeShadow: 3, integrated: 0 });
    expect(p?.score).toBeCloseTo(-1);
    expect(p?.arc).toBe("active-shadow");
  });

  it("reads mixed when the two ends are close", () => {
    const p = posturePosition({ activeShadow: 2, integrated: 2 });
    expect(p?.score).toBeCloseTo(0);
    expect(p?.arc).toBe("mixed");
  });

  it("has no position without posture-bearing evidence", () => {
    expect(posturePosition({ activeShadow: 0, integrated: 0 })).toBeNull();
  });
});

describe("normalize", () => {
  it("returns per-tribe shares that sum to 100, proportional to the raw scores", () => {
    const pct = normalize({ a: 3, b: 1 });
    expect(pct.a).toBeCloseTo(75);
    expect(pct.b).toBeCloseTo(25);
    expect(pct.a + pct.b).toBeCloseTo(100);
  });

  it("returns all zeros when every score is zero (no divide-by-zero)", () => {
    const pct = normalize({ a: 0, b: 0, c: 0 });
    expect(pct).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("does not mutate the underlying independent scores", () => {
    const raw = { a: 3, b: 1 };
    normalize(raw);
    expect(raw).toEqual({ a: 3, b: 1 });
  });

  it("keeps a tribe with no evidence at 0%", () => {
    const pct = normalize({ a: 4, b: 0 });
    expect(pct.a).toBeCloseTo(100);
    expect(pct.b).toBe(0);
  });
});
