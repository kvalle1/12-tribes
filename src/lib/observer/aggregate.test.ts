import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";

const scoreOf = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 others profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("judah"), wordsForTribe("levi")]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("reports the number of observers aggregated", () => {
    expect(aggregateObservers([]).count).toBe(0);
    expect(
      aggregateObservers([wordsForTribe("judah"), wordsForTribe("levi")]).count,
    ).toBe(2);
  });

  it("returns an all-zero others profile and no per-observer rows for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the single observer's own profile unchanged when there is exactly one", () => {
    const words = wordsForTribe("judah");
    const agg = aggregateObservers([words]);
    const solo = score(words);
    expect(agg.count).toBe(1);
    for (const t of tribes) {
      expect(scoreOf(t.slug, agg.others)).toBeCloseTo(scoreOf(t.slug, solo));
    }
  });

  it("exposes each observer's individually-normalized profile in input order", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    for (const t of tribes) {
      expect(scoreOf(t.slug, agg.perObserver[0])).toBeCloseTo(scoreOf(t.slug, score(a)));
      expect(scoreOf(t.slug, agg.perObserver[1])).toBeCloseTo(scoreOf(t.slug, score(b)));
    }
  });

  it("is the equal-weight average of each observer's normalized scores", () => {
    const a = [...wordsForTribe("judah"), "Bold"];
    const b = wordsForTribe("levi");
    const c = [...wordsForTribe("issachar")];
    const agg = aggregateObservers([a, b, c]);
    for (const t of tribes) {
      const expected =
        (scoreOf(t.slug, agg.perObserver[0]) +
          scoreOf(t.slug, agg.perObserver[1]) +
          scoreOf(t.slug, agg.perObserver[2])) /
        3;
      expect(scoreOf(t.slug, agg.others)).toBeCloseTo(expected);
    }
  });

  it("weights each observer equally rather than pooling their words (a word-heavy observer cannot dominate)", () => {
    // Observer 1 expresses only judah. Observer 2 expresses judah AND levi, so
    // it picks strictly more words. In a pooled bag-of-words, observer 2's extra
    // words would make levi look as universal as a fully-shared trait. Equal
    // weighting damps levi, because only one of the two observers flagged it.
    const judah = wordsForTribe("judah");
    const levi = wordsForTribe("levi");
    const agg = aggregateObservers([judah, [...judah, ...levi]]);
    const pooled = score([...judah, ...levi]);

    expect(scoreOf("levi", agg.others)).toBeLessThan(scoreOf("levi", pooled));
  });
});
