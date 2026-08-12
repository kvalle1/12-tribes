import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero profile and a zero count for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toHaveLength(0);
  });

  it("scores every tribe in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns each observer's normalized profile in input order", () => {
    const a = wordsForTribe(tribes[0].slug);
    const b = wordsForTribe(tribes[1].slug);
    const agg = aggregateObservers([a, b]);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
  });

  it("averages the per-observer normalized scores equally (each observer is 1/n)", () => {
    const words = wordsForTribe(tribes[0].slug);
    const single = score(words);
    // One observer picks the words; a second observer picks nothing.
    const agg = aggregateObservers([words, []]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(
        scoreFor(tribe.slug, single) / 2,
        10,
      );
    }
  });

  it("gives an observer no extra influence for picking more words", () => {
    // Observer A floods many words for tribe[0]; observer B picks nothing.
    // Because A's normalized score is capped at its own profile and every
    // observer carries weight 1/n, A can never push the aggregate past
    // (A's normalized score / n) — word count buys no extra sway.
    const many = wordsForTribe(tribes[0].slug);
    const agg = aggregateObservers([many, []]);
    const soloTop = scoreFor(tribes[0].slug, score(many));
    expect(scoreFor(tribes[0].slug, agg.scores)).toBeCloseTo(soloTop / 2, 10);
    expect(scoreFor(tribes[0].slug, agg.scores)).toBeLessThan(soloTop);
  });

  it("is an average of profiles, not a pooled bag of words", () => {
    const a = wordsForTribe(tribes[0].slug);
    const b = wordsForTribe(tribes[1].slug);
    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);
    // The pooled bag normalizes both tribes toward their own ceilings at once;
    // the equal-weight average halves each observer's contribution instead.
    const diffs = tribes.map((t) =>
      Math.abs(scoreFor(t.slug, agg.scores) - scoreFor(t.slug, pooled)),
    );
    expect(Math.max(...diffs)).toBeGreaterThan(0);
  });
});

describe("isComparisonUnlocked", () => {
  it(`is locked below ${MIN_OBSERVERS} observers`, () => {
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it(`unlocks at exactly ${MIN_OBSERVERS} observers and stays unlocked`, () => {
    expect(isComparisonUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
