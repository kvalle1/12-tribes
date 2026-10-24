import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug — mirrors the scoring tests. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a 12-tribe average in canonical order with 0–1 scores", () => {
    const { average } = aggregateObservers([["Courageous"], ["Wise"]]);
    expect(average).toHaveLength(12);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("reports how many observers responded", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([["Courageous"], ["Wise"], ["Loyal"]]).observerCount,
    ).toBe(3);
  });

  it("scores each observer individually with the same core as self", () => {
    const words = ["Courageous", "Bold", "Wise"];
    const { perObserver } = aggregateObservers([words]);
    expect(perObserver).toHaveLength(1);
    // Each observer's scores are exactly what the shared scoring core produces.
    expect(perObserver[0]).toEqual(score(words));
  });

  it("averages each observer's normalized scores with equal weight", () => {
    // The central invariant (ADR-0003): the 'others' profile is the mean of each
    // observer's individually-normalized tribe scores, so every observer counts
    // the same regardless of how many words they picked.
    const a = ["Courageous"];
    const b = wordsForTribe("issachar"); // a deliberately long selection
    const { average, perObserver } = aggregateObservers([a, b]);

    const scoreA = score(a);
    const scoreB = score(b);
    expect(perObserver).toEqual([scoreA, scoreB]);

    for (let i = 0; i < average.length; i++) {
      expect(average[i].score).toBeCloseTo((scoreA[i].score + scoreB[i].score) / 2);
    }
  });

  it("gives a word-heavy observer no extra influence (not a pooled bag of words)", () => {
    // Observer A names one Judah word; Observer B picks Issachar's whole set.
    // Equal-weight averaging counts each observer's normalized profile once, so
    // Issachar is the mean of 'didn't pick it' (0) and 'picked all of it' (1.0).
    const a = ["Courageous"]; // judah-only
    const b = wordsForTribe("issachar"); // every issachar word → issachar = 1.0

    const { average } = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]); // what a 'pooled bag of words' would give

    expect(scoreFor("issachar", average)).toBeCloseTo(0.5);
    // Pooling the words instead lets B's large pile dominate, pushing Issachar
    // well above the equal-weight 0.5 — so the two genuinely differ and we are
    // not pooling.
    expect(scoreFor("issachar", pooled)).toBeGreaterThan(
      scoreFor("issachar", average) + 0.05,
    );
  });

  it("yields an all-zero average for no observers", () => {
    const { average, perObserver, observerCount } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(average).toHaveLength(12);
    expect(average.every((s) => s.score === 0)).toBe(true);
  });

  it("does not mutate the caller's response arrays", () => {
    const responses = [["Courageous"], ["Wise"]];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("isComparisonUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(5)).toBe(true);
  });
});
