import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero, empty aggregate for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((t) => t.score === 0)).toBe(true);
    expect(agg.average.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer individually with the same core as the Self flow", () => {
    const responses = [wordsForTribe("levi"), ["Courageous"]];
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    // Each observer's profile is exactly what the shared scoring core produces.
    expect(agg.perObserver[0]).toEqual(score(responses[0]));
    expect(agg.perObserver[1]).toEqual(score(responses[1]));
  });

  it("averages per-observer normalized scores with equal weight", () => {
    const responses = [wordsForTribe("judah"), ["Courageous"], []];
    const agg = aggregateObservers(responses);
    for (const tribe of tribes) {
      const expected =
        agg.perObserver.reduce((sum, obs) => sum + scoreFor(tribe.slug, obs), 0) /
        agg.perObserver.length;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected);
    }
  });

  it("does not let a heavy-picking observer dominate (equal weight, not a pooled bag of words)", () => {
    // Observer A picks every Judah word (Judah = 1.0 for them); Observer B picks
    // a single Judah-only word (a small Judah score). If we pooled all words
    // together, B's word is a subset of A's, so pooled Judah would still be 1.0.
    // Equal-weight averaging instead lands halfway between the two observers.
    const judahFull = wordsForTribe("judah");
    const responses = [judahFull, ["Courageous"]];
    const agg = aggregateObservers(responses);

    const judahA = scoreFor("judah", score(judahFull)); // 1.0
    const judahB = scoreFor("judah", score(["Courageous"])); // small
    expect(judahA).toBeCloseTo(1);
    expect(judahB).toBeGreaterThan(0);
    expect(judahB).toBeLessThan(1);

    const judahAvg = scoreFor("judah", agg.average);
    expect(judahAvg).toBeCloseTo((judahA + judahB) / 2);
    // The pooled-bag answer would be 1.0 — confirm we are clearly below it.
    expect(judahAvg).toBeLessThan(0.9);
  });

  it("keeps the average in canonical tribe order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg.average.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the observer threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD - 1)).toBe(false);
  });

  it("unlocks the report at or above the observer threshold", () => {
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD)).toBe(true);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD + 1)).toBe(true);
  });

  it("unlocks at exactly three observers (ADR-0003)", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });
});
