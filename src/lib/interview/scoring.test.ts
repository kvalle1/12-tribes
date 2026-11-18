import { describe, expect, it } from "vitest";
import {
  aggregatePosture,
  applyDeltas,
  normalize,
  postureLean,
  routeDelta,
} from "./scoring";
import type { MarkerDelta, ScoreTraceEntry } from "./types";

const d = (
  markerId: string,
  tribeSlug: string,
  type: MarkerDelta["type"],
  delta: number,
  postureSignal: MarkerDelta["postureSignal"] = "neutral",
): MarkerDelta => ({ markerId, tribeSlug, type, delta, postureSignal });

/** A stub oil-Marker resolver: every tribe's oil Marker is `<slug>-oil`. */
const oilResolver = (slug: string) => `${slug}-oil`;

const trace = (
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"],
): ScoreTraceEntry => ({ turnIndex: 0, markerId: "m", tribeSlug, type, delta, postureSignal });

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
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      2,
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

describe("routeDelta (matured fall-line → oil, ADR-0004)", () => {
  it("routes a matured fall-line (integrated) to the tribe's oil Marker", () => {
    const routed = routeDelta(d("judah-fall-power", "judah", "fallLine", 3, "integrated"), oilResolver);
    expect(routed).toEqual({
      markerId: "judah-oil",
      tribeSlug: "judah",
      type: "oil",
      delta: 3,
      postureSignal: "integrated",
    });
  });

  it("preserves the strength contribution when routing (never lowers it)", () => {
    const routed = routeDelta(d("simeon-fall-cruelty", "simeon", "fallLine", 3, "integrated"), oilResolver);
    expect(routed.delta).toBe(3);
  });

  it("leaves an active-shadow fall-line as a fall-line (not matured)", () => {
    const delta = d("judah-fall-power", "judah", "fallLine", 3, "active-shadow");
    expect(routeDelta(delta, oilResolver)).toEqual(delta);
  });

  it("leaves a neutral fall-line untouched", () => {
    const delta = d("judah-fall-power", "judah", "fallLine", 3, "neutral");
    expect(routeDelta(delta, oilResolver)).toEqual(delta);
  });

  it("does not reroute non-fall-line deltas even when integrated", () => {
    const delta = d("judah-strength-front", "judah", "strength", 2, "integrated");
    expect(routeDelta(delta, oilResolver)).toEqual(delta);
  });

  it("leaves a matured fall-line unrouted when the tribe has no oil Marker", () => {
    const delta = d("judah-fall-power", "judah", "fallLine", 3, "integrated");
    expect(routeDelta(delta, () => undefined)).toEqual(delta);
  });
});

describe("applyDeltas routing (ADR-0004)", () => {
  it("records a matured fall-line in the trace as the oil Marker, strength intact", () => {
    const { profile, trace } = applyDeltas(
      { judah: 1 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      4,
      oilResolver,
    );
    // Strength still rose by the full contribution — maturity never lowers it.
    expect(profile.judah).toBe(4);
    // ...but the evidence is cross-confirmed through the oil Marker.
    expect(trace).toEqual([
      {
        turnIndex: 4,
        markerId: "judah-oil",
        tribeSlug: "judah",
        type: "oil",
        delta: 3,
        postureSignal: "integrated",
      },
    ]);
  });

  it("applies deltas unrouted when no resolver is supplied (back-compat)", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
    );
    expect(trace[0].type).toBe("fallLine");
    expect(trace[0].markerId).toBe("judah-fall-power");
  });
});

describe("aggregatePosture", () => {
  it("sums each tribe's posture signals into arc buckets, weighted by delta", () => {
    const posture = aggregatePosture([
      trace("judah", "fallLine", 3, "integrated"),
      trace("judah", "oil", 2, "integrated"),
      trace("judah", "shadow", 2, "active-shadow"),
      trace("judah", "strength", 1, "neutral"),
    ]);
    expect(posture.judah).toEqual({ activeShadow: 2, integrated: 5, neutral: 1 });
  });

  it("keeps tribes independent", () => {
    const posture = aggregatePosture([
      trace("judah", "fallLine", 3, "active-shadow"),
      trace("levi", "oil", 2, "integrated"),
    ]);
    expect(posture.judah).toEqual({ activeShadow: 3, integrated: 0, neutral: 0 });
    expect(posture.levi).toEqual({ activeShadow: 0, integrated: 2, neutral: 0 });
  });

  it("returns an empty profile for an empty trace", () => {
    expect(aggregatePosture([])).toEqual({});
  });
});

describe("postureLean", () => {
  it("leans integrated when integrated evidence dominates", () => {
    expect(postureLean({ activeShadow: 1, integrated: 4, neutral: 0 })).toBe("integrated");
  });

  it("leans active-shadow when shadow evidence dominates", () => {
    expect(postureLean({ activeShadow: 5, integrated: 2, neutral: 0 })).toBe("active-shadow");
  });

  it("is neutral when the two poles balance", () => {
    expect(postureLean({ activeShadow: 3, integrated: 3, neutral: 9 })).toBe("neutral");
  });

  it("is neutral for a tribe with no posture evidence", () => {
    expect(postureLean(undefined)).toBe("neutral");
  });

  it("a matured fall-line, once routed and aggregated, reads as integrated", () => {
    const { trace } = applyDeltas(
      { gad: 0 },
      [d("gad-fall-burnout", "gad", "fallLine", 3, "integrated")],
      0,
      oilResolver,
    );
    expect(postureLean(aggregatePosture(trace).gad)).toBe("integrated");
  });
});
