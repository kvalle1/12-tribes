import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { rankTribes } from "./ranking";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("rankTribes", () => {
  it("returns every one of the 12 tribes", () => {
    const ranked = rankTribes(wordsForTribe("judah"));
    expect(ranked).toHaveLength(tribes.length);
    expect(new Set(ranked.map((r) => r.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
  });

  it("orders tribes by normalized score, descending", () => {
    const ranked = rankTribes(wordsForTribe("judah"));
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("gives the top tribe a full bar (fraction 1) and scales the rest to it", () => {
    const words = wordsForTribe("judah");
    const ranked = rankTribes(words);
    const top = ranked[0];
    expect(top.fraction).toBe(1);

    // Every fraction is that tribe's score relative to the top score.
    for (const r of ranked) {
      expect(r.fraction).toBeCloseTo(r.score / top.score, 10);
    }
  });

  it("matches the underlying normalized scores from score()", () => {
    const words = wordsForTribe("judah");
    const ranked = rankTribes(words);
    const scoreBySlug = new Map(score(words).map((s) => [s.slug, s.score]));
    for (const r of ranked) {
      expect(r.score).toBe(scoreBySlug.get(r.slug));
    }
  });

  it("yields all-zero fractions for an empty selection (no divide-by-zero)", () => {
    const ranked = rankTribes([]);
    expect(ranked).toHaveLength(tribes.length);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.every((r) => r.fraction === 0)).toBe(true);
  });

  it("keeps canonical tribe order when scores tie (empty selection)", () => {
    const ranked = rankTribes([]);
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});
