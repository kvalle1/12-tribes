import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  isObserverReportUnlocked,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero when there are no observer responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the observer's own profile for a single response", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg)).toBeCloseTo(scoreFor(t.slug, self));
    }
  });

  it("is the equal-weight average of each observer's normalized profile", () => {
    const responses = [["Courageous"], wordsForTribe("levi"), ["Bold"]];
    const perObserver = responses.map((r) => score(r));
    const agg = aggregateObservers(responses);
    for (const t of tribes) {
      const mean =
        perObserver.reduce((sum, s) => sum + scoreFor(t.slug, s), 0) /
        perObserver.length;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("counts each observer equally regardless of how many words they picked", () => {
    // A 1-word observer and a 6-word observer must weigh the same. Aggregating
    // per-observer normalized profiles makes each tribe the plain mean of the
    // two observers' scores, independent of word counts.
    const fewWords = ["Courageous"]; // 1 word (judah)
    const manyWords = wordsForTribe("levi"); // 6 words (levi)
    const [s1, s2] = [score(fewWords), score(manyWords)];
    const agg = aggregateObservers([fewWords, manyWords]);
    for (const t of tribes) {
      const mean = (scoreFor(t.slug, s1) + scoreFor(t.slug, s2)) / 2;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("aggregates normalized profiles, not a pooled bag of words", () => {
    // Were the words pooled, the 6-word levi observer would swamp the 1-word
    // judah observer and levi would score a full 1.0. Equal-weight averaging
    // keeps levi at half, so no single observer dominates the "others" view.
    const agg = aggregateObservers([["Courageous"], wordsForTribe("levi")]);
    const pooled = score(["Courageous", ...wordsForTribe("levi")]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg)).toBeLessThan(scoreFor("levi", pooled));
  });

  it("delegates word handling to the scoring core (unknowns and duplicates ignored)", () => {
    const clean = aggregateObservers([["Courageous"]]);
    const noisy = aggregateObservers([["Courageous", "Courageous", "notaword"]]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, noisy)).toBeCloseTo(scoreFor(t.slug, clean));
    }
  });
});

describe("isObserverReportUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isObserverReportUnlocked(0)).toBe(false);
    expect(isObserverReportUnlocked(2)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isObserverReportUnlocked(3)).toBe(true);
    expect(isObserverReportUnlocked(5)).toBe(true);
  });
});
