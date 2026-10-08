import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreEachObserver,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

// Two tribes with disjoint-enough word sets to build clean fixtures from.
const [tribeA, tribeB] = tribes.map((t) => t.slug);

describe("aggregateObservers", () => {
  it("returns a 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe(tribeA).slice(0, 8)]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own scores when there is exactly one", () => {
    const words = wordsForTribe(tribeA).slice(0, 8);
    const agg = aggregateObservers([words]);
    const own = score(words);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg)).toBeCloseTo(scoreFor(t.slug, own), 10);
    }
  });

  it("averages per-observer normalized scores, not a pooled bag of words", () => {
    // Observer 1 picks MANY words, all for tribe A. Observer 2 picks FEW words,
    // all for tribe B. Pooling the words would let observer 1 (more words)
    // dominate; equal-weight averaging must give each observer the same say.
    const manyForA = wordsForTribe(tribeA);
    const fewForB = wordsForTribe(tribeB).slice(0, 2);
    expect(manyForA.length).toBeGreaterThan(fewForB.length);

    const agg = aggregateObservers([manyForA, fewForB]);

    // Each tribe's aggregate is the mean of the two observers' own normalized
    // scores for that tribe — independent of how many words each picked.
    const own1 = score(manyForA);
    const own2 = score(fewForB);
    for (const t of tribes) {
      const expected =
        (scoreFor(t.slug, own1) + scoreFor(t.slug, own2)) / 2;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(expected, 10);
    }
  });

  it("gives every observer equal weight regardless of selection size", () => {
    // Observer 1: all of tribe A's words (a high normalized A score).
    // Observer 2: a single word for tribe B.
    // Observer 1's extra words must NOT buy tribe A more aggregate influence
    // than observer 2's one word buys tribe B, relative to each one's own
    // normalized score.
    const allA = wordsForTribe(tribeA);
    const oneB = wordsForTribe(tribeB).slice(0, 1);

    const agg = aggregateObservers([allA, oneB]);
    const ownAForObs1 = scoreFor(tribeA, score(allA));
    const ownBForObs2 = scoreFor(tribeB, score(oneB));

    // A's aggregate is exactly half of observer 1's own A score (observer 2
    // contributes 0 to A), and likewise B is half of observer 2's own B score.
    expect(scoreFor(tribeA, agg)).toBeCloseTo(ownAForObs1 / 2, 10);
    expect(scoreFor(tribeB, agg)).toBeCloseTo(ownBForObs2 / 2, 10);
  });

  it("ignores unknown words and duplicates the same way the scoring core does", () => {
    const words = wordsForTribe(tribeA).slice(0, 8);
    const noisy = [...words, ...words, "definitely-not-a-word"];
    const agg = aggregateObservers([noisy]);
    const clean = aggregateObservers([words]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg)).toBeCloseTo(scoreFor(t.slug, clean), 10);
    }
  });
});

describe("scoreEachObserver", () => {
  it("returns one normalized score table per observer, in input order", () => {
    const wordsA = wordsForTribe(tribeA).slice(0, 8);
    const wordsB = wordsForTribe(tribeB).slice(0, 8);
    const perObserver = scoreEachObserver([wordsA, wordsB]);

    expect(perObserver).toHaveLength(2);
    for (const table of perObserver) {
      expect(table.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Each table matches scoring that observer's words directly.
    expect(perObserver[0]).toEqual(score(wordsA));
    expect(perObserver[1]).toEqual(score(wordsB));
  });

  it("returns an empty list for no observers", () => {
    expect(scoreEachObserver([])).toEqual([]);
  });
});

describe("MIN_OBSERVERS_FOR_REPORT", () => {
  it("is 3 (ADR-0003: the report unlocks at ≥3 observers)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
