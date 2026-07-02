import { describe, expect, it } from "vitest";
import type { Marker } from "./markers";
import { applyScoring, normalizeProfile } from "./score";

/**
 * A tiny hand-built catalog. The engine is tested against its public behavior —
 * given cited deltas, what profile and trace come out — not against the real
 * 72-Marker catalog, so these read as executable specs and survive catalog edits.
 */
const CATALOG: Marker[] = [
  { id: "judah-strength", tribeSlug: "judah", type: "strength", signal: "leads from the front", weight: 1 },
  { id: "judah-fall", tribeSlug: "judah", type: "fallLine", signal: "abuses power", weight: 3 },
  { id: "levi-strength", tribeSlug: "levi", type: "strength", signal: "guards the holy", weight: 1 },
];

const lookup = (id: string) => CATALOG.find((m) => m.id === id);

function zeroed(...slugs: string[]) {
  return Object.fromEntries(slugs.map((s) => [s, 0]));
}

describe("applyScoring", () => {
  it("scales a delta by its Marker's weight and adds it to the tribe", () => {
    const { profile } = applyScoring(
      zeroed("judah", "levi"),
      [{ markerId: "judah-strength", tribeSlug: "judah", type: "strength", delta: 1 }],
      lookup,
    );
    expect(profile.judah).toBe(1); // 1 (delta) × 1 (weight)
    expect(profile.levi).toBe(0);
  });

  it("weights a fall-line Marker more heavily than a strength Marker", () => {
    const { profile } = applyScoring(
      zeroed("judah"),
      [{ markerId: "judah-fall", tribeSlug: "judah", type: "fallLine", delta: 1 }],
      lookup,
    );
    expect(profile.judah).toBe(3); // fall-line weight is 3
  });

  it("treats shadow/fall-line as additive — it never lowers strength (ADR-0004)", () => {
    const base = { judah: 5, levi: 0 };
    // A negative delta must not subtract from the tribe; it clamps to a 0 contribution.
    const { profile, applied } = applyScoring(
      base,
      [{ markerId: "judah-fall", tribeSlug: "judah", type: "fallLine", delta: -0.9 }],
      lookup,
    );
    expect(profile.judah).toBe(5); // unchanged, never reduced
    expect(applied[0].contribution).toBe(0);
  });

  it("clamps evidence strength into [0, 1] before weighting", () => {
    const { profile } = applyScoring(
      zeroed("judah"),
      [{ markerId: "judah-fall", tribeSlug: "judah", type: "fallLine", delta: 4 }],
      lookup,
    );
    expect(profile.judah).toBe(3); // clamped to 1 × weight 3, not 4 × 3
  });

  it("does not mutate the input profile", () => {
    const base = zeroed("judah", "levi");
    applyScoring(base, [{ markerId: "judah-strength", tribeSlug: "judah", type: "strength", delta: 1 }], lookup);
    expect(base.judah).toBe(0);
  });

  it("retains a trace of every applied delta (answer → Marker → delta)", () => {
    const { applied } = applyScoring(
      zeroed("judah", "levi"),
      [
        { markerId: "judah-strength", tribeSlug: "judah", type: "strength", delta: 0.5, postureSignal: "integrated" },
        { markerId: "levi-strength", tribeSlug: "levi", type: "strength", delta: 0.8 },
      ],
      lookup,
    );
    expect(applied).toEqual([
      { markerId: "judah-strength", tribeSlug: "judah", type: "strength", delta: 0.5, weight: 1, contribution: 0.5, postureSignal: "integrated" },
      { markerId: "levi-strength", tribeSlug: "levi", type: "strength", delta: 0.8, weight: 1, contribution: 0.8, postureSignal: "neutral" },
    ]);
  });

  it("ignores a delta that cites an unknown Marker (ADR-0003)", () => {
    const { profile, applied } = applyScoring(
      zeroed("judah"),
      [{ markerId: "does-not-exist", tribeSlug: "judah", type: "strength", delta: 1 }],
      lookup,
    );
    expect(profile.judah).toBe(0);
    expect(applied).toHaveLength(0);
  });

  it("ignores a delta whose tribeSlug disagrees with the cited Marker", () => {
    const { profile, applied } = applyScoring(
      zeroed("judah", "levi"),
      [{ markerId: "judah-strength", tribeSlug: "levi", type: "strength", delta: 1 }],
      lookup,
    );
    expect(profile.judah).toBe(0);
    expect(profile.levi).toBe(0);
    expect(applied).toHaveLength(0);
  });
});

describe("normalizeProfile", () => {
  it("projects scores onto display percentages that sum to 100", () => {
    const shares = normalizeProfile({ judah: 3, levi: 1, dan: 0 });
    expect(shares.judah).toBeCloseTo(75);
    expect(shares.levi).toBeCloseTo(25);
    expect(shares.dan).toBe(0);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it("normalizes an all-zero profile to all zeros without dividing by zero", () => {
    const shares = normalizeProfile({ judah: 0, levi: 0 });
    expect(shares).toEqual({ judah: 0, levi: 0 });
  });

  it("leaves underlying scores independent — a high raw score can still be a modest share", () => {
    // Two tribes each with raw strength 10 → 50% each, even though 10 is 'high'.
    const shares = normalizeProfile({ judah: 10, levi: 10 });
    expect(shares.judah).toBeCloseTo(50);
    expect(shares.levi).toBeCloseTo(50);
  });
});
