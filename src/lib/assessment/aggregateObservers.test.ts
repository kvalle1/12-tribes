import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores every tribe zero when there are no observer responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own normalized score", () => {
    // Averaging one profile is that profile — the aggregation reuses the same
    // scoring core, so a lone observer's read is passed through unchanged.
    const words = wordsForTribe("levi");
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // Observer A reads pure Levi, Observer B reads pure Issachar. Each scores
    // their own tribe 1.0 individually; the equal-weight average halves both.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg)).toBeCloseTo(0.5);
  });

  it("averages independent reads instead of pooling all words into one bag", () => {
    // One observer reads pure Levi → the aggregate is that read (levi 1.0).
    const leviAlone = aggregateObservers([wordsForTribe("levi")]);
    expect(scoreFor("levi", leviAlone)).toBeCloseTo(1.0);

    // Add an observer who saw no Levi → equal-weight averaging pulls levi to 0.5,
    // the second read counting as much as the first (ADR-0003).
    const twoObservers = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", twoObservers)).toBeCloseTo(0.5);

    // A pooled bag-of-words would concatenate both observers and score once,
    // leaving levi at full coverage (1.0) — indifferent to how many observers
    // actually saw Levi. Equal-weight aggregation is strictly below that, which
    // is the whole point of aggregating per-observer profiles rather than words.
    const pooledBag = score([
      ...wordsForTribe("levi"),
      ...wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", pooledBag)).toBeCloseTo(1.0);
    expect(scoreFor("levi", twoObservers)).toBeLessThan(
      scoreFor("levi", pooledBag),
    );
  });

  it("averages three observers arithmetically", () => {
    // Two observers read Levi, one reads Issachar → levi 2/3, issachar 1/3.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", agg)).toBeCloseTo(2 / 3);
    expect(scoreFor("issachar", agg)).toBeCloseTo(1 / 3);
  });

  it("ignores unknown words the same way the scoring core does", () => {
    const withJunk = aggregateObservers([["notaword", "Courageous"]]);
    const clean = aggregateObservers([["Courageous"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, withJunk)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });

  it("unlocks the comparison report at three observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
