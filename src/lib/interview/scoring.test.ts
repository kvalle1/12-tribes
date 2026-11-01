import { describe, expect, it } from "vitest";
import {
  accumulatePosture,
  applyDeltas,
  normalize,
  postureReading,
  posturesFromTrace,
  routeMaturedFallLines,
} from "./scoring";
import type { MarkerDelta, ScoreTraceEntry } from "./types";

const d = (
  markerId: string,
  tribeSlug: string,
  type: MarkerDelta["type"],
  delta: number,
  postureSignal: MarkerDelta["postureSignal"] = "neutral",
): MarkerDelta => ({ markerId, tribeSlug, type, delta, postureSignal });

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

const trace = (
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"],
  turnIndex = 0,
  markerId = `${tribeSlug}-m`,
): ScoreTraceEntry => ({ turnIndex, markerId, tribeSlug, type, delta, postureSignal });

describe("routeMaturedFallLines (ADR-0004)", () => {
  // A deterministic resolver keeps the routing rule testable without the catalog.
  const oilFor = (slug: string) => `${slug}-oil`;

  it("re-attributes an integrated fall-line to the tribe's oil Marker", () => {
    const [routed] = routeMaturedFallLines(
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      oilFor,
    );
    expect(routed.markerId).toBe("judah-oil");
    expect(routed.type).toBe("oil");
  });

  it("preserves the tribe, the delta magnitude, and the integrated signal when routing", () => {
    const [routed] = routeMaturedFallLines(
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      oilFor,
    );
    expect(routed.tribeSlug).toBe("judah");
    expect(routed.delta).toBe(3); // never lowered
    expect(routed.postureSignal).toBe("integrated");
  });

  it("leaves a fall-line that is not integrated untouched", () => {
    const deltas = [
      d("m1", "judah", "fallLine", 3, "active-shadow"),
      d("m2", "levi", "fallLine", 3, "neutral"),
    ];
    expect(routeMaturedFallLines(deltas, oilFor)).toEqual(deltas);
  });

  it("leaves non-fall-line deltas untouched even when integrated", () => {
    const deltas = [d("m1", "judah", "shadow", 2, "integrated")];
    expect(routeMaturedFallLines(deltas, oilFor)).toEqual(deltas);
  });

  it("degrades gracefully when no oil Marker resolves — delta passes through", () => {
    const deltas = [d("m1", "judah", "fallLine", 3, "integrated")];
    expect(routeMaturedFallLines(deltas, () => undefined)).toEqual(deltas);
  });

  it("uses the real catalog by default: judah's integrated fall-line routes to its oil Marker", () => {
    const [routed] = routeMaturedFallLines([
      d("judah-fall-power", "judah", "fallLine", 3, "integrated"),
    ]);
    expect(routed.markerId).toBe("judah-oil-responsibility");
    expect(routed.type).toBe("oil");
  });
});

describe("accumulatePosture (ADR-0004)", () => {
  it("adds an integrated entry's weight to the integrated side", () => {
    const posture = accumulatePosture([trace("judah", "oil", 3, "integrated")]);
    expect(posture.judah).toEqual({ integrated: 3, activeShadow: 0 });
  });

  it("adds an active-shadow entry's weight to the active-shadow side", () => {
    const posture = accumulatePosture([trace("dan", "shadow", 2, "active-shadow")]);
    expect(posture.dan).toEqual({ integrated: 0, activeShadow: 2 });
  });

  it("ignores neutral entries entirely (a strength-only tribe gets no tally)", () => {
    const posture = accumulatePosture([trace("levi", "strength", 1, "neutral")]);
    expect(posture.levi).toBeUndefined();
  });

  it("accumulates both ends across turns for the same tribe", () => {
    const posture = accumulatePosture([
      trace("judah", "shadow", 2, "active-shadow", 0),
      trace("judah", "oil", 3, "integrated", 1),
      trace("judah", "oil", 1, "integrated", 2),
    ]);
    expect(posture.judah).toEqual({ integrated: 4, activeShadow: 2 });
  });
});

describe("postureReading (ADR-0004)", () => {
  it("reads integrated-dominant evidence as integrated, position > 0", () => {
    const reading = postureReading({ integrated: 4, activeShadow: 1 });
    expect(reading.label).toBe("integrated");
    expect(reading.position).toBeGreaterThan(0);
  });

  it("reads active-shadow-dominant evidence as active-shadow, position < 0", () => {
    const reading = postureReading({ integrated: 1, activeShadow: 4 });
    expect(reading.label).toBe("active-shadow");
    expect(reading.position).toBeLessThan(0);
  });

  it("reads a near-even split as mixed", () => {
    const reading = postureReading({ integrated: 3, activeShadow: 3 });
    expect(reading.label).toBe("mixed");
    expect(reading.position).toBeCloseTo(0);
  });

  it("reads no evidence as unknown with a null position", () => {
    expect(postureReading(undefined)).toEqual({ position: null, label: "unknown" });
    expect(postureReading({ integrated: 0, activeShadow: 0 })).toEqual({
      position: null,
      label: "unknown",
    });
  });
});

describe("matured fall-line, end to end (route → apply → posture)", () => {
  it("keeps full strength on the tribe and moves its Posture toward integrated", () => {
    const routed = routeMaturedFallLines(
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      (slug) => `${slug}-oil`,
    );
    const { profile, trace: applied } = applyDeltas({ judah: 2 }, routed, 0);

    // Strength is never lowered by maturity — the full fall-line delta still lands.
    expect(profile.judah).toBe(5);

    const readings = posturesFromTrace(applied);
    expect(readings.judah.label).toBe("integrated");
  });
});
