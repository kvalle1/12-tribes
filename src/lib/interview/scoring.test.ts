import { describe, expect, it } from "vitest";
import { aggregatePosture, applyDeltas, arcPosition, normalize } from "./scoring";
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

describe("applyDeltas — matured fall-line → oil routing (ADR-0004)", () => {
  // Stub resolver: every tribe's oil Marker is "<tribe>-oil".
  const oilFor = (slug: string) => `${slug}-oil`;

  it("routes a matured (integrated) fall-line to the tribe's oil Marker in the trace", () => {
    const { trace } = applyDeltas(
      { dan: 0 },
      [d("dan-fall-idolatry", "dan", "fallLine", 3, "integrated")],
      1,
      oilFor,
    );
    expect(trace[0].markerId).toBe("dan-oil");
    expect(trace[0].type).toBe("oil");
    expect(trace[0].tribeSlug).toBe("dan");
    expect(trace[0].postureSignal).toBe("integrated");
  });

  it("does not reduce strength when routing a matured fall-line (keeps the full delta)", () => {
    const { profile } = applyDeltas(
      { dan: 2 },
      [d("dan-fall-idolatry", "dan", "fallLine", 3, "integrated")],
      0,
      oilFor,
    );
    // The fall-line's full contribution still lands on the tribe's strength;
    // routing changes the attribution, never the amount.
    expect(profile.dan).toBe(5);
  });

  it("leaves an active-shadow fall-line attributed to the fall line, not oil", () => {
    const { trace } = applyDeltas(
      { dan: 0 },
      [d("dan-fall-idolatry", "dan", "fallLine", 3, "active-shadow")],
      0,
      oilFor,
    );
    expect(trace[0].markerId).toBe("dan-fall-idolatry");
    expect(trace[0].type).toBe("fallLine");
  });

  it("does not route a non-fall-line Marker even when it reads integrated", () => {
    const { trace } = applyDeltas(
      { dan: 0 },
      [d("dan-shadow-cynicism", "dan", "shadow", 2, "integrated")],
      0,
      oilFor,
    );
    expect(trace[0].markerId).toBe("dan-shadow-cynicism");
    expect(trace[0].type).toBe("shadow");
  });

  it("leaves the fall line in place when no resolver is given (back-compat)", () => {
    const { trace } = applyDeltas(
      { dan: 0 },
      [d("dan-fall-idolatry", "dan", "fallLine", 3, "integrated")],
      0,
    );
    expect(trace[0].markerId).toBe("dan-fall-idolatry");
    expect(trace[0].type).toBe("fallLine");
  });

  it("falls back to the fall line when the resolver can't find an oil Marker", () => {
    const { trace } = applyDeltas(
      { dan: 0 },
      [d("dan-fall-idolatry", "dan", "fallLine", 3, "integrated")],
      0,
      () => undefined,
    );
    expect(trace[0].markerId).toBe("dan-fall-idolatry");
    expect(trace[0].type).toBe("fallLine");
  });
});

describe("aggregatePosture", () => {
  const t = (
    tribeSlug: string,
    delta: number,
    postureSignal: ScoreTraceEntry["postureSignal"],
    type: ScoreTraceEntry["type"] = "strength",
  ): ScoreTraceEntry => ({ turnIndex: 0, markerId: "m", tribeSlug, type, delta, postureSignal });

  it("tallies integrated and active-shadow evidence per tribe", () => {
    const posture = aggregatePosture([
      t("dan", 3, "integrated"),
      t("dan", 2, "active-shadow"),
      t("judah", 1, "active-shadow"),
    ]);
    expect(posture.dan).toEqual({ activeShadow: 2, integrated: 3 });
    expect(posture.judah).toEqual({ activeShadow: 1, integrated: 0 });
  });

  it("ignores neutral evidence, so a tribe with only neutral answers never appears", () => {
    const posture = aggregatePosture([t("levi", 4, "neutral")]);
    expect(posture.levi).toBeUndefined();
  });

  it("shows a matured-then-routed fall line as integrated posture", () => {
    // A fall-line scored integrated and routed to oil still carries its
    // integrated posture signal, so it accrues at the oil end of the arc.
    const posture = aggregatePosture([t("dan", 3, "integrated", "oil")]);
    expect(posture.dan).toEqual({ activeShadow: 0, integrated: 3 });
  });

  it("returns an empty profile for an empty trace", () => {
    expect(aggregatePosture([])).toEqual({});
  });
});

describe("arcPosition", () => {
  it("reads integrated when the oil end leads", () => {
    expect(arcPosition({ activeShadow: 1, integrated: 3 })).toBe("integrated");
  });

  it("reads active-shadow when the fall end leads", () => {
    expect(arcPosition({ activeShadow: 4, integrated: 1 })).toBe("active-shadow");
  });

  it("reads mixed when both ends are present and even", () => {
    expect(arcPosition({ activeShadow: 2, integrated: 2 })).toBe("mixed");
  });

  it("reads unknown with no posture-bearing evidence", () => {
    expect(arcPosition({ activeShadow: 0, integrated: 0 })).toBe("unknown");
    expect(arcPosition(undefined)).toBe("unknown");
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
