import { describe, expect, it } from "vitest";

import { tribes } from "@/lib/tribes";
import { emptyProfile } from "./flow";
import { markerCatalog } from "./markers";
import { applyScoring, rankedProfile, toPercentages } from "./scoring";
import type { MarkerDelta } from "./types";

// Pull real Markers out of the authored catalog so the tests exercise the same
// ids/weights the agent must cite at runtime.
const strengthMarker = markerCatalog.find((m) => m.type === "strength")!;
const shadowMarker = markerCatalog.find((m) => m.type === "shadow")!;
const otherTribeStrength = markerCatalog.find(
  (m) => m.type === "strength" && m.tribeSlug !== strengthMarker.tribeSlug,
)!;

function cite(marker: (typeof markerCatalog)[number], delta: number): MarkerDelta {
  return { markerId: marker.id, tribeSlug: marker.tribeSlug, type: marker.type, delta };
}

describe("applyScoring", () => {
  it("adds a Marker's weighted contribution to its tribe's strength", () => {
    const { profile } = applyScoring(emptyProfile(), "answer", [cite(strengthMarker, 1)]);
    expect(profile[strengthMarker.tribeSlug]).toBe(1 * strengthMarker.weight);
  });

  it("treats shadow/fall-line deltas as additive and never lets them lower strength", () => {
    // A positive shadow delta raises strength (it is evidence you ARE the tribe).
    const positive = applyScoring(emptyProfile(), "a", [cite(shadowMarker, 1)]);
    expect(positive.profile[shadowMarker.tribeSlug]).toBeGreaterThan(0);

    // A negative delta is clamped to zero — it can never subtract from strength.
    const negative = applyScoring(emptyProfile(), "a", [cite(shadowMarker, -1)]);
    expect(negative.profile[shadowMarker.tribeSlug]).toBe(0);
    expect(negative.trace).toHaveLength(0);
  });

  it("clamps an over-1 delta so a single answer can't dominate", () => {
    const { profile } = applyScoring(emptyProfile(), "a", [cite(strengthMarker, 5)]);
    expect(profile[strengthMarker.tribeSlug]).toBe(1 * strengthMarker.weight);
  });

  it("records a trace linking each applied delta to its answer and Marker id", () => {
    const answer = "I stepped to the front and carried the decision when it mattered most.";
    const { trace } = applyScoring(emptyProfile(), answer, [cite(strengthMarker, 0.8)]);

    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      answer,
      markerId: strengthMarker.id,
      tribeSlug: strengthMarker.tribeSlug,
      type: strengthMarker.type,
      delta: 0.8,
    });
    expect(trace[0].contribution).toBeCloseTo(0.8 * strengthMarker.weight, 10);
  });

  it("ignores a delta citing a Marker that isn't in the catalog", () => {
    const { profile, trace } = applyScoring(emptyProfile(), "a", [
      { markerId: "no-such-marker", tribeSlug: "judah", type: "strength", delta: 1 },
    ]);
    expect(trace).toHaveLength(0);
    expect(Object.values(profile).every((v) => v === 0)).toBe(true);
  });

  it("ignores a delta whose tribeSlug disagrees with the cited Marker", () => {
    const wrongTribe = tribes.find((t) => t.slug !== strengthMarker.tribeSlug)!.slug;
    const { profile, trace } = applyScoring(emptyProfile(), "a", [
      { markerId: strengthMarker.id, tribeSlug: wrongTribe, type: strengthMarker.type, delta: 1 },
    ]);
    expect(trace).toHaveLength(0);
    expect(Object.values(profile).every((v) => v === 0)).toBe(true);
  });

  it("does not mutate the input profile", () => {
    const before = emptyProfile();
    applyScoring(before, "a", [cite(strengthMarker, 1)]);
    expect(Object.values(before).every((v) => v === 0)).toBe(true);
  });
});

describe("toPercentages", () => {
  it("normalizes to percentages that sum to 100 while leaving underlying scores independent", () => {
    const { profile } = applyScoring(emptyProfile(), "a", [
      cite(strengthMarker, 1),
      cite(otherTribeStrength, 1),
    ]);
    const snapshot = { ...profile };

    const pct = toPercentages(profile);
    const sum = Object.values(pct).reduce((s, v) => s + v, 0);

    expect(sum).toBeCloseTo(100, 6);
    expect(pct[strengthMarker.tribeSlug]).toBeGreaterThan(0);
    // The independent raw scores are unchanged by taking percentages.
    expect(profile).toEqual(snapshot);
  });

  it("returns all-zero percentages for an empty profile (no divide-by-zero)", () => {
    const pct = toPercentages(emptyProfile());
    expect(Object.values(pct).every((v) => v === 0)).toBe(true);
  });
});

describe("rankedProfile", () => {
  it("ranks all 12 tribes by raw score, highest first", () => {
    const { profile } = applyScoring(emptyProfile(), "a", [cite(strengthMarker, 1)]);
    const ranked = rankedProfile(profile);

    expect(ranked).toHaveLength(tribes.length);
    expect(ranked[0].slug).toBe(strengthMarker.tribeSlug);
    expect(ranked[0].percent).toBeCloseTo(100, 6);
  });
});
