import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { rankProfile } from "./profile";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("rankProfile", () => {
  it("returns every one of the 12 tribes with its full Tribe object", () => {
    const ranked = rankProfile(["Courageous"]);
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.tribe.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
    // Each row carries the full Tribe (so the view can read accent, callSign…).
    for (const row of ranked) {
      expect(row.tribe.name).toBeTruthy();
      expect(row.tribe.color).toBeTruthy();
    }
  });

  it("ranks the tribes by normalized score, highest first", () => {
    const ranked = rankProfile([...wordsForTribe("levi"), "Courageous"]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    // Levi dominates this selection.
    expect(ranked[0].tribe.slug).toBe("levi");
  });

  it("carries the same normalized scores the scoring core produces", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const bySlug = new Map(score(words).map((s) => [s.slug, s.score]));
    for (const row of rankProfile(words)) {
      expect(row.score).toBeCloseTo(bySlug.get(row.tribe.slug)!);
    }
  });

  it("gives the top tribe a full bar and scales the rest proportionally", () => {
    const ranked = rankProfile([...wordsForTribe("levi"), "Courageous"]);
    expect(ranked[0].barFraction).toBeCloseTo(1);
    for (const row of ranked) {
      expect(row.barFraction).toBeCloseTo(row.score / ranked[0].score);
      expect(row.barFraction).toBeGreaterThanOrEqual(0);
      expect(row.barFraction).toBeLessThanOrEqual(1);
    }
  });

  it("breaks score ties by canonical tribe order", () => {
    // "Bold" maps to judah (#1) + reuben (#3) at 0.5 raw each; their normalized
    // scores can differ by coverage, so use an explicit equal-score case instead:
    // selecting nothing leaves all scores 0 and the order must stay canonical.
    const ranked = rankProfile([]);
    expect(ranked.map((r) => r.tribe.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("handles an empty selection: all 12 tribes, zero scores, zero bars", () => {
    const ranked = rankProfile([]);
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.every((r) => r.barFraction === 0)).toBe(true);
  });
});
