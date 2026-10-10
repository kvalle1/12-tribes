import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero others profile for no observers", () => {
    const { observerCount, others, perObserver } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own score for one observer", () => {
    const words = wordsForTribe("levi");
    const { observerCount, others } = aggregateObservers([words]);
    const solo = score(words);
    expect(observerCount).toBe(1);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("averages per-observer normalized scores (equal weight, not pooled)", () => {
    // Observer A sees pure Levi; Observer B sees pure Judah. The equal-weight
    // others profile is the mean of the two normalized profiles, so Levi and
    // Judah each land at half of a single observer's full-coverage score.
    const levi = wordsForTribe("levi");
    const judah = wordsForTribe("judah");
    const { others } = aggregateObservers([levi, judah]);

    const soloLevi = scoreFor("levi", score(levi));
    const soloJudah = scoreFor("judah", score(judah));
    expect(scoreFor("levi", others)).toBeCloseTo(soloLevi / 2);
    expect(scoreFor("judah", others)).toBeCloseTo(soloJudah / 2);
  });

  it("gives a word-heavy observer no more influence than a sparse one", () => {
    // Both observers point at Levi, but one selects every Levi word and the
    // other selects a single Levi word. Equal weighting means the average is the
    // simple mean of their two normalized Levi scores — the heavy picker does
    // not drag the others profile toward a perfect Levi read.
    const allLevi = wordsForTribe("levi");
    const oneLevi = [allLevi[0]];
    const { others } = aggregateObservers([allLevi, oneLevi]);

    const heavy = scoreFor("levi", score(allLevi));
    const sparse = scoreFor("levi", score(oneLevi));
    expect(scoreFor("levi", others)).toBeCloseTo((heavy + sparse) / 2);
    // Pooling the words instead would have scored strictly higher than the mean.
    expect(scoreFor("levi", others)).toBeLessThan(heavy);
  });

  it("exposes each observer's individual normalized profile for drill-down", () => {
    const levi = wordsForTribe("levi");
    const judah = wordsForTribe("judah");
    const { perObserver } = aggregateObservers([levi, judah]);

    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(levi));
    expect(perObserver[1]).toEqual(score(judah));
  });

  it("keeps the others profile in canonical tribe order", () => {
    const { others } = aggregateObservers([wordsForTribe("levi")]);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("isReportUnlocked", () => {
  it(`unlocks only at ${OBSERVER_UNLOCK_THRESHOLD} or more observers`, () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD - 1)).toBe(false);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD)).toBe(true);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD + 5)).toBe(true);
  });
});
