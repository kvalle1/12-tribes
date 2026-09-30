import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
  hasEnoughObservers,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

const sumOf = (scores: TribeScore[]) =>
  scores.reduce((total, s) => total + s.score, 0);

/** Rescale a profile to unit mass — the reference the average is built on. */
const unitMass = (words: readonly string[]) => {
  const s = score(words);
  const total = sumOf(s);
  return s.map((x) => (total > 0 ? x.score / total : 0));
};

describe("aggregateObservers", () => {
  it("reports how many observers were aggregated", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg.count).toBe(3);
    expect(agg.observers).toHaveLength(3);
  });

  it("returns an all-zero average for no observers (never divides by zero)", () => {
    const agg = aggregateObservers([]);
    expect(agg.count).toBe(0);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the average in canonical (tribe number) order for all 12 tribes", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("keeps each observer's own raw (coverage-normalized) scores for the drill-down", () => {
    const agg = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    // Observer 1 fully covers levi → levi normalizes to 1.0 for them alone.
    expect(scoreFor("levi", agg.observers[0].scores)).toBeCloseTo(1);
    // Observer 2's raw scores match scoring their words in isolation.
    expect(agg.observers[1].scores).toEqual(score(["Courageous"]));
  });

  it("averages each observer's unit-mass profile with equal weight", () => {
    const responses = [wordsForTribe("levi"), ["Courageous"], ["Zealous"]];
    const profiles = responses.map(unitMass);
    const agg = aggregateObservers(responses);
    tribes.forEach((tribe, t) => {
      const expected =
        profiles.reduce((sum, p) => sum + p[t], 0) / responses.length;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected);
    });
  });

  it("gives every observer equal total mass — the average sums to 1", () => {
    // Each observer is rescaled to unit mass before averaging, so the mean is a
    // unit-mass profile too. This is the property that word count can't influence.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      wordsForTribe("issachar"),
    ]);
    expect(sumOf(agg.average)).toBeCloseTo(1);
  });

  it("is NOT a pooled bag of words — differs from scoring all words together", () => {
    // A wordy observer (full issachar coverage) and a brief one (two judah-ish
    // words). Pooling every word and dividing by N would let the wordy observer
    // carry more mass; the equal-weight average does not, so the two disagree.
    const wordy = wordsForTribe("issachar");
    const brief = ["Courageous", "Bold"];
    const equalWeight = aggregateObservers([wordy, brief]).average;
    const pooledPerN = score([...wordy, ...brief]).map((s) => s.score / 2);

    const differs = tribes.some(
      (tribe, t) =>
        Math.abs(scoreFor(tribe.slug, equalWeight) - pooledPerN[t]) > 1e-6,
    );
    expect(differs).toBe(true);
  });

  it("does not let a wordy observer drown out a brief one", () => {
    // The brief observer points at judah with just two words; the wordy one at
    // issachar with ten. Equal weighting keeps judah prominent (the brief
    // observer's full vote), where pooling would swamp it under the wordy one.
    const wordy = wordsForTribe("issachar");
    const brief = ["Courageous", "Bold"];
    const equalWeight = aggregateObservers([wordy, brief]).average;
    const pooledPerN = score([...wordy, ...brief]).map((s) => s.score / 2);
    const judahPooled = pooledPerN[tribes.findIndex((t) => t.slug === "judah")];

    expect(scoreFor("judah", equalWeight)).toBeGreaterThan(judahPooled);
  });

  it("weights every observer equally regardless of how many words they select", () => {
    // Halving the first observer's word count must not change the second
    // observer's (judah) contribution: it stays a full, equal vote either way.
    const many = wordsForTribe("levi");
    const few = many.slice(0, Math.max(1, Math.floor(many.length / 2)));
    const withMany = aggregateObservers([many, ["Courageous"]]);
    const withFew = aggregateObservers([few, ["Courageous"]]);
    expect(scoreFor("judah", withMany.average)).toBeCloseTo(
      scoreFor("judah", withFew.average),
    );
  });

  it("labels observers anonymously as 1..n in input order, carrying no identity", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg.observers.map((o) => o.index)).toEqual([1, 2, 3]);
    // Each observer profile exposes only an index and scores — nothing else.
    for (const observer of agg.observers) {
      expect(Object.keys(observer).sort()).toEqual(["index", "scores"]);
    }
  });

  it("does not mutate the input responses", () => {
    const responses = [["Courageous"], ["Bold"]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at or above the threshold of 3", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
