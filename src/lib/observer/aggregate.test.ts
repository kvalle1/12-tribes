import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS } from "./aggregate";

/** All words that map to a given tribe slug (mapping-agnostic fixtures). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Two distinct tribes to build contrasting Observer selections from.
const A = tribes[0].slug;
const B = tribes[1].slug;

describe("aggregateObservers", () => {
  it("returns all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe(A)]);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores an empty input as all zeros", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single Observer's own normalized profile for one Observer", () => {
    const words = wordsForTribe(A).slice(0, 4);
    const agg = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("is the equal-weight average of each Observer's normalized profile", () => {
    const obsA = wordsForTribe(A);
    const obsB = wordsForTribe(B).slice(0, 2);
    const agg = aggregateObservers([obsA, obsB]);
    const sa = score(obsA);
    const sb = score(obsB);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("gives every Observer equal influence regardless of word count (not a pooled bag)", () => {
    // obsA selects many words for tribe A; obsB selects few words for tribe B.
    const obsA = wordsForTribe(A);
    const obsB = wordsForTribe(B).slice(0, 2);

    const equalWeight = scoreFor(A, aggregateObservers([obsA, obsB]));
    // Pooling all words into one bag would let the word-heavy Observer dominate.
    const pooled = scoreFor(A, score([...obsA, ...obsB]));

    // Under equal weighting, obsA's high A-score is halved by obsB's near-zero,
    // so tribe A lands well below what pooling (word count = influence) yields.
    expect(equalWeight).toBeLessThan(pooled);
    expect(equalWeight).toBeCloseTo(
      (scoreFor(A, score(obsA)) + scoreFor(A, score(obsB))) / 2,
    );
  });

  it("ignores duplicate and unknown words within an Observer (a selection is a set)", () => {
    const words = wordsForTribe(A).slice(0, 3);
    const withNoise = [...words, ...words, "definitely-not-a-word"];
    const clean = aggregateObservers([words]);
    const noisy = aggregateObservers([withNoise]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, noisy)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });

  it("unlocks the report at three Observers", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
