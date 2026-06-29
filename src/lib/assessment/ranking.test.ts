import { describe, it, expect } from "vitest";
import { rankTribes } from "./ranking";

describe("rankTribes", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankTribes(["Courageous"]);
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.tribe.slug)).size).toBe(12);
  });

  it("is sorted by score descending", () => {
    const ranked = rankTribes(["Courageous", "Bold", "Honorable", "Wise"]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("gives the leader a bar fraction of 1 and keeps all fractions in [0,1]", () => {
    const ranked = rankTribes(["Courageous", "Honorable", "Wise"]);
    expect(ranked[0].fraction).toBeCloseTo(1);
    for (const r of ranked) {
      expect(r.fraction).toBeGreaterThanOrEqual(0);
      expect(r.fraction).toBeLessThanOrEqual(1);
    }
  });

  it("ranks a single tribe's words first as the sole non-zero score", () => {
    // All four are Judah-only words → Judah leads, everything else is zero.
    const ranked = rankTribes([
      "Authoritative",
      "Courageous",
      "Honorable",
      "Sacrificial",
    ]);
    expect(ranked[0].tribe.slug).toBe("judah");
    expect(ranked.filter((r) => r.score > 0)).toHaveLength(1);
    expect(ranked[0].fraction).toBeCloseTo(1);
  });

  it("matches deriveResult: the top of the ranking is the Primary", () => {
    // A Levi-heavy selection should put Levi at rank 0, consistent with the
    // headline the result page shows from deriveResult.
    const ranked = rankTribes(["Dedicated", "Devoted", "Precise", "Reverent"]);
    expect(ranked[0].tribe.slug).toBe("levi");
  });

  it("returns all-zero scores and zero fractions for an empty selection", () => {
    const ranked = rankTribes([]);
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.every((r) => r.fraction === 0)).toBe(true);
  });
});
