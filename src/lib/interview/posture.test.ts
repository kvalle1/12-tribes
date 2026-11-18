import { describe, expect, it } from "vitest";
import {
  accumulatePosture,
  arcFraming,
  arcLabel,
  emptyPosture,
  postureFor,
  POSTURE_LEAN_THRESHOLD,
} from "./posture";
import type { ScoreTraceEntry } from "./types";

/**
 * A trace entry with sensible defaults, overridable per test. `delta` defaults
 * to 1 so posture is driven by the `postureSignal` unless a test says otherwise.
 */
function entry(partial: Partial<ScoreTraceEntry>): ScoreTraceEntry {
  return {
    turnIndex: 0,
    markerId: "judah-strength-front",
    tribeSlug: "judah",
    type: "strength",
    delta: 1,
    postureSignal: "neutral",
    ...partial,
  };
}

describe("accumulatePosture", () => {
  it("returns no posture for an empty trace", () => {
    expect(accumulatePosture([])).toEqual({});
  });

  it("ignores neutral signals (no posture-bearing evidence → neutral arc)", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "judah", postureSignal: "neutral", delta: 3 }),
    ]);
    expect(posture.judah).toEqual({
      integrated: 0,
      activeShadow: 0,
      lean: 0,
      arc: "neutral",
    });
  });

  it("leans integrated when integrated evidence dominates", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 2 }),
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 1 }),
    ]);
    expect(posture.dan.integrated).toBe(3);
    expect(posture.dan.activeShadow).toBe(0);
    expect(posture.dan.lean).toBe(1);
    expect(posture.dan.arc).toBe("integrated");
  });

  it("leans active-shadow when shadow evidence dominates", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "active-shadow", delta: 3 }),
    ]);
    expect(posture.dan.lean).toBe(-1);
    expect(posture.dan.arc).toBe("active-shadow");
  });

  it("is mixed when the two poles roughly balance", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 2 }),
      entry({ tribeSlug: "dan", postureSignal: "active-shadow", delta: 2 }),
    ]);
    expect(posture.dan.lean).toBe(0);
    expect(posture.dan.arc).toBe("mixed");
  });

  it("weights evidence by delta, not by count", () => {
    // Three weak shadow signals vs one strong integrated signal: integrated wins.
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "active-shadow", delta: 1 }),
      entry({ tribeSlug: "dan", postureSignal: "active-shadow", delta: 1 }),
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 5 }),
    ]);
    expect(posture.dan.lean).toBeGreaterThan(POSTURE_LEAN_THRESHOLD);
    expect(posture.dan.arc).toBe("integrated");
  });

  it("accumulates each tribe independently", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 2 }),
      entry({ tribeSlug: "levi", postureSignal: "active-shadow", delta: 2 }),
    ]);
    expect(posture.dan.arc).toBe("integrated");
    expect(posture.levi.arc).toBe("active-shadow");
  });

  it("a matured fall-line routed to the oil Marker reads as integrated", () => {
    // After routing (agent.ts), a matured fall-line appears in the trace as an
    // oil-type entry carrying an `integrated` signal. Posture must read it as a
    // move toward integrated — the ADR-0004 confound resolution.
    const posture = accumulatePosture([
      entry({
        tribeSlug: "dan",
        type: "oil",
        markerId: "dan-oil-trust",
        postureSignal: "integrated",
        delta: 3,
      }),
    ]);
    expect(posture.dan.arc).toBe("integrated");
  });
});

describe("postureFor / emptyPosture", () => {
  it("returns a neutral posture for a tribe with no trace evidence", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 1 }),
    ]);
    expect(postureFor(posture, "levi")).toEqual(emptyPosture());
    expect(emptyPosture().arc).toBe("neutral");
  });

  it("returns the tribe's posture when present", () => {
    const posture = accumulatePosture([
      entry({ tribeSlug: "dan", postureSignal: "integrated", delta: 1 }),
    ]);
    expect(postureFor(posture, "dan").arc).toBe("integrated");
  });
});

describe("arcLabel", () => {
  it("gives a human label for every arc position", () => {
    expect(arcLabel("integrated")).toMatch(/integrat/i);
    expect(arcLabel("active-shadow")).toMatch(/shadow/i);
    expect(arcLabel("mixed")).toMatch(/mid-arc/i);
    expect(arcLabel("neutral")).toBeTruthy();
  });
});

describe("arcFraming", () => {
  it("has no status warning for an active tribe", () => {
    const copy = arcFraming({ status: "active", arc: "integrated", tribeName: "Judah" });
    expect(copy).toBeTruthy();
    expect(copy).not.toMatch(/disqualified|warning/i);
  });

  it("returns null for an active tribe with no posture evidence", () => {
    expect(arcFraming({ status: "active", arc: "neutral", tribeName: "Judah" })).toBeNull();
  });

  it("gives a redemption reading for a disqualified tribe on the integrated arc", () => {
    const copy = arcFraming({ status: "disqualified", arc: "integrated", tribeName: "Simeon" });
    expect(copy).toBeTruthy();
    expect(copy).toMatch(/Simeon/);
    // Non-condemning: names the redeemed/integrated side, not a verdict.
    expect(copy).toMatch(/integrat|redeem/i);
  });

  it("gives a cautionary — not condemning — reading for a disqualified tribe on the active-shadow arc", () => {
    const copy = arcFraming({ status: "disqualified", arc: "active-shadow", tribeName: "Simeon" })!;
    expect(copy).toMatch(/caution/i);
    // A caution, explicitly not a verdict/condemnation.
    expect(copy).toMatch(/not a verdict|caution/i);
  });

  it("always frames non-active tribes, even with neutral posture", () => {
    for (const status of ["warning", "disqualified", "disqualified-arc"] as const) {
      expect(arcFraming({ status, arc: "neutral", tribeName: "Reuben" })).toBeTruthy();
    }
  });
});
