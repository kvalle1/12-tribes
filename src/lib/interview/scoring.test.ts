import { describe, expect, it } from "vitest";
import {
  accumulatePosture,
  applyDeltas,
  classifyPosture,
  normalize,
  posturePerTribe,
  readPosture,
} from "./scoring";
import type { MarkerDelta, ScoreTraceEntry } from "./types";

const d = (
  markerId: string,
  tribeSlug: string,
  type: MarkerDelta["type"],
  delta: number,
  postureSignal: MarkerDelta["postureSignal"] = "neutral",
): MarkerDelta => ({ markerId, tribeSlug, type, delta, postureSignal });

const trace = (
  turnIndex: number,
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"] = "neutral",
): ScoreTraceEntry => ({
  turnIndex,
  markerId: `${tribeSlug}-${type}`,
  tribeSlug,
  type,
  delta,
  postureSignal,
});

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

describe("accumulatePosture", () => {
  it("routes an active-shadow delta's weight to the active-shadow pole", () => {
    const posture = accumulatePosture({}, [d("m1", "simeon", "fallLine", 3, "active-shadow")]);
    expect(posture.simeon).toEqual({ activeShadow: 3, integrated: 0 });
  });

  it("routes an integrated delta's weight to the integrated pole", () => {
    const posture = accumulatePosture({}, [d("m1", "dan", "oil", 2, "integrated")]);
    expect(posture.dan).toEqual({ activeShadow: 0, integrated: 2 });
  });

  it("ignores neutral signals — they carry no posture weight", () => {
    const posture = accumulatePosture({}, [d("m1", "judah", "strength", 4, "neutral")]);
    expect(posture.judah).toBeUndefined();
  });

  it("accumulates onto existing tallies without mutating the input", () => {
    const before = { dan: { activeShadow: 2, integrated: 0 } };
    const after = accumulatePosture(before, [d("m1", "dan", "oil", 3, "integrated")]);
    expect(after.dan).toEqual({ activeShadow: 2, integrated: 3 });
    expect(before.dan).toEqual({ activeShadow: 2, integrated: 0 });
  });

  it("uses the clamped (non-negative) weight, never a negative delta", () => {
    // A negative delta clamps to zero weight, so it adds no posture evidence —
    // the tribe stays absent rather than appearing with an empty tally.
    const posture = accumulatePosture({}, [d("m1", "simeon", "fallLine", -5, "active-shadow")]);
    expect(posture.simeon).toBeUndefined();
  });
});

describe("posturePerTribe", () => {
  it("folds a whole trace into per-tribe tallies", () => {
    const t = [
      trace(0, "dan", "fallLine", 2, "active-shadow"),
      trace(2, "dan", "oil", 3, "integrated"),
      trace(1, "judah", "strength", 4, "neutral"),
    ];
    const posture = posturePerTribe(t);
    expect(posture.dan).toEqual({ activeShadow: 2, integrated: 3 });
    expect(posture.judah).toBeUndefined();
  });
});

describe("classifyPosture", () => {
  it("reads integrated-dominant evidence as integrated, with a positive score", () => {
    const reading = classifyPosture({ activeShadow: 1, integrated: 5 });
    expect(reading.arc).toBe("integrated");
    expect(reading.score).toBeGreaterThan(0);
  });

  it("reads active-shadow-dominant evidence as active-shadow, with a negative score", () => {
    const reading = classifyPosture({ activeShadow: 5, integrated: 1 });
    expect(reading.arc).toBe("active-shadow");
    expect(reading.score).toBeLessThan(0);
  });

  it("reads balanced evidence as mixed", () => {
    const reading = classifyPosture({ activeShadow: 3, integrated: 3 });
    expect(reading.arc).toBe("mixed");
    expect(reading.score).toBeCloseTo(0);
  });

  it("reads no posture evidence as unknown", () => {
    const reading = classifyPosture({ activeShadow: 0, integrated: 0 });
    expect(reading.arc).toBe("unknown");
    expect(reading.score).toBe(0);
  });
});

describe("matured fall-line → oil routing shifts Posture toward integrated (ADR-0004)", () => {
  // The agent routes a matured fall-line to the tribe's oil Marker with an
  // `integrated` posture signal. The engine must (a) raise strength, never lower
  // it, and (b) move Posture toward integrated — cross-confirming the tribe via
  // a different Marker type while rewarding, not penalising, maturity.
  it("raises strength and reads integrated when a matured fall-line routes to oil", () => {
    const deltas = [d("dan-oil-trust", "dan", "oil", 3, "integrated")];
    const { profile } = applyDeltas({ dan: 4 }, deltas, 0);
    const posture = classifyPosture(accumulatePosture({}, deltas).dan);
    expect(profile.dan).toBe(7); // strength rose
    expect(posture.arc).toBe("integrated");
  });

  it("moves a tribe off active-shadow toward integrated as maturity evidence lands later", () => {
    const early = accumulatePosture({}, [d("m1", "dan", "fallLine", 3, "active-shadow")]);
    expect(classifyPosture(early.dan).arc).toBe("active-shadow");

    const later = accumulatePosture(early, [
      d("m2", "dan", "oil", 4, "integrated"),
      d("m3", "dan", "oil", 3, "integrated"),
    ]);
    const reading = classifyPosture(later.dan);
    expect(reading.arc).toBe("integrated");
    expect(reading.score).toBeGreaterThan(0);
  });
});

describe("readPosture", () => {
  it("classifies every tribe that has posture evidence in the trace", () => {
    const t = [
      trace(0, "simeon", "fallLine", 4, "active-shadow"),
      trace(1, "dan", "oil", 4, "integrated"),
      trace(2, "judah", "strength", 5, "neutral"),
    ];
    const posture = readPosture(t);
    expect(posture.simeon.arc).toBe("active-shadow");
    expect(posture.dan.arc).toBe("integrated");
    // A tribe with only neutral (non-posture-bearing) evidence is absent.
    expect(posture.judah).toBeUndefined();
  });
});
