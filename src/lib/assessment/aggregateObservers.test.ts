import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  hasEnoughObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
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

  it("returns a single observer's own normalized scores unchanged", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg)).toBeCloseTo(scoreFor(t.slug, self));
    }
  });

  it("returns the equal-weight mean of each tribe's per-observer normalized score", () => {
    const responses = [["Courageous"], ["Bold"], wordsForTribe("levi")];
    const agg = aggregateObservers(responses);
    for (const t of tribes) {
      const mean =
        responses.reduce((sum, w) => sum + scoreFor(t.slug, score(w)), 0) /
        responses.length;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("averages per-observer normalized scores, not a pooled bag of words", () => {
    // One observer picks a single Judah word; another picks every Judah word
    // (Judah = 1.0). The equal-weight mean sits between the two. A pooled bag of
    // words would instead be score(union) — here 1.0, since the single word is a
    // subset — which is strictly higher. This is the ADR-0003 distinction.
    const oneJudahWord = ["Courageous"];
    const allJudah = wordsForTribe("judah");
    const agg = aggregateObservers([oneJudahWord, allJudah]);

    const mean =
      (scoreFor("judah", score(oneJudahWord)) +
        scoreFor("judah", score(allJudah))) /
      2;
    expect(scoreFor("judah", agg)).toBeCloseTo(mean);

    const pooled = scoreFor("judah", score([...oneJudahWord, ...allJudah]));
    expect(scoreFor("judah", agg)).toBeLessThan(pooled);
  });

  it("weights a verbose and a terse observer equally — each contributes 1/N", () => {
    // A verbose observer (many words) and a terse one (a single word) each get
    // exactly half the say: every tribe's aggregate is the mean of their two
    // individual normalized scores, so word count buys no extra weight
    // (ADR-0003 equal-weight aggregation).
    const verbose = wordsForTribe("levi");
    const terse = ["Courageous"];
    const agg = aggregateObservers([verbose, terse]);
    for (const t of tribes) {
      const contribution =
        (scoreFor(t.slug, score(verbose)) + scoreFor(t.slug, score(terse))) / 2;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(contribution);
    }
  });

  it("ignores unknown words within an observer's selection", () => {
    const agg = aggregateObservers([["notaword", "Courageous"]]);
    expect(scoreFor("judah", agg)).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])),
    );
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks at the threshold and not before", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(OBSERVER_UNLOCK_THRESHOLD - 1)).toBe(false);
    expect(hasEnoughObservers(OBSERVER_UNLOCK_THRESHOLD)).toBe(true);
    expect(hasEnoughObservers(OBSERVER_UNLOCK_THRESHOLD + 5)).toBe(true);
  });
});
