import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { rankTribes } from "./ranking";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("rankTribes", () => {
  it("returns an entry for all 12 tribes", () => {
    const ranked = rankTribes(["Courageous"]);
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.tribe.slug)).size).toBe(12);
  });

  it("resolves each entry to the real Tribe object", () => {
    const bySlug = new Map(tribes.map((t) => [t.slug, t]));
    for (const r of rankTribes(["Courageous"])) {
      expect(r.tribe).toBe(bySlug.get(r.tribe.slug));
    }
  });

  it("sorts by normalized score descending", () => {
    const ranked = rankTribes([...wordsForTribe("levi"), "Courageous"]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    // The dominant tribe (levi, fully covered) ranks first.
    expect(ranked[0].tribe.slug).toBe("levi");
  });

  it("gives the top-ranked tribe a relative width of 1 when anything scored", () => {
    const ranked = rankTribes([...wordsForTribe("levi"), "Courageous"]);
    expect(ranked[0].relative).toBeCloseTo(1);
  });

  it("makes relative width the score as a fraction of the top score", () => {
    const ranked = rankTribes([...wordsForTribe("levi"), "Courageous"]);
    const max = ranked[0].score;
    for (const r of ranked) {
      expect(r.relative).toBeCloseTo(max > 0 ? r.score / max : 0);
    }
  });

  it("returns all-zero relative widths for an empty selection (no divide-by-zero)", () => {
    const ranked = rankTribes([]);
    expect(ranked).toHaveLength(12);
    for (const r of ranked) {
      expect(r.score).toBe(0);
      expect(r.relative).toBe(0);
      expect(Number.isNaN(r.relative)).toBe(false);
    }
  });

  it("keeps canonical tribe order among ties (empty selection ⇒ all tied at 0)", () => {
    const ranked = rankTribes([]);
    expect(ranked.map((r) => r.tribe.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("normalized score stays in 0–1", () => {
    for (const r of rankTribes([...wordsForTribe("levi"), "Courageous"])) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});
