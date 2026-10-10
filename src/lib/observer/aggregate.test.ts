import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  hasEnoughObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([
      { words: ["Courageous"] },
      { words: ["Analytical"] },
    ]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero for no observers (never divides by zero)", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals that observer's own score for a single observer", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const agg = aggregateObservers([{ words }]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("is the equal-weight mean of each observer's individually-normalized scores", () => {
    const responses = [
      { words: wordsForTribe("levi") },
      { words: ["Courageous", "Bold"] },
      { words: wordsForTribe("issachar") },
    ];
    const agg = aggregateObservers(responses);
    const perObserver = responses.map((r) => score(r.words));
    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, s) => sum + scoreFor(tribe.slug, s), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // One observer picks a single word; another picks all six of Levi's words.
    // Equal-weight averaging means the six-word observer's Levi signal counts
    // for exactly 1/2 — the same per-capita weight as the one-word observer's
    // Judah signal — never more because they selected more words.
    const oneWord = { words: ["Courageous"] }; // judah
    const manyWords = { words: wordsForTribe("levi") }; // levi === 1.0 for that observer
    const agg = aggregateObservers([oneWord, manyWords]);

    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("judah", agg)).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])) / 2,
    );
  });

  it("is not a pooled bag of words (word count does not buy influence)", () => {
    const oneWord = { words: ["Courageous"] }; // judah
    const manyWords = { words: wordsForTribe("levi") }; // levi

    const aggregated = scoreFor("levi", aggregateObservers([oneWord, manyWords]));
    // Pooling both observers' words into one selection would score Levi at a
    // full 1.0 — the many-word observer would dominate. Equal-weight keeps it 0.5.
    const pooled = scoreFor("levi", score([...oneWord.words, ...manyWords.words]));

    expect(pooled).toBeCloseTo(1);
    expect(aggregated).toBeCloseTo(0.5);
    expect(aggregated).not.toBeCloseTo(pooled);
  });

  it("weights each additional observer by exactly 1/n", () => {
    const a = { words: ["Courageous"] };
    const b = { words: ["Analytical"] };
    const twoWay = scoreFor("judah", aggregateObservers([a, b]));
    const threeWay = scoreFor("judah", aggregateObservers([a, b, b]));
    // Judah appears only in observer a. With two observers its weight is /2,
    // with three it is /3 — strictly diluted by the extra non-Judah observer.
    expect(twoWay).toBeCloseTo(scoreFor("judah", score(a.words)) / 2);
    expect(threeWay).toBeCloseTo(scoreFor("judah", score(a.words)) / 3);
  });
});

describe("hasEnoughObservers (ADR-0003 ≥3 unlock)", () => {
  it("locks the report below the threshold", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(1)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
  });

  it("unlocks at and above the threshold", () => {
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(4)).toBe(true);
  });
});
