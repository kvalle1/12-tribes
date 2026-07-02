import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  aggregateProfiles,
  isComparisonUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
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

  it("with a single observer, equals that observer's own normalized score", () => {
    const words = ["Courageous", "Bold"];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg)).toBeCloseTo(scoreFor(t.slug, solo));
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // One observer scores judah-only (full point), the other reuben-only.
    const a = wordsForTribe("judah");
    const b = wordsForTribe("reuben");
    const agg = aggregateObservers([a, b]);
    // Each observer contributes their own normalized score, then we average by
    // the observer count (2). So judah = (judahFromA + judahFromB) / 2.
    const soloA = score(a);
    const soloB = score(b);
    for (const t of tribes) {
      const expected =
        (scoreFor(t.slug, soloA) + scoreFor(t.slug, soloB)) / 2;
      expect(scoreFor(t.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("gives each observer equal influence regardless of how many words they picked", () => {
    // ADR-0003: the aggregate is the average of individually-normalized scores,
    // NOT a pooled bag of words — an observer who selects more words must not
    // gain more sway. Observer A picks ALL of levi's words (many); Observer B
    // picks a single judah word. Each should still count for exactly half.
    const manyWords = wordsForTribe("levi"); // full coverage → levi = 1.0 for A
    const fewWords = ["Courageous"]; // judah-only single word for B

    const agg = aggregateObservers([manyWords, fewWords]);

    // A alone scores levi 1.0 and judah 0; B alone scores judah > 0 and levi 0.
    // Equal-weight average => levi = 1.0/2 = 0.5 exactly, unaffected by A's larger
    // word count. A pooled-bag approach would have diluted levi far below 0.5.
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);

    const judahSolo = scoreFor("judah", score(fewWords));
    expect(scoreFor("judah", agg)).toBeCloseTo(judahSolo / 2);
  });

  it("does not mutate the caller's responses", () => {
    const responses = [["Courageous"], ["Bold"]];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("aggregateProfiles", () => {
  it("matches aggregateObservers when fed the same observers' scored profiles", () => {
    // The report scores each observer once and feeds the profiles here directly,
    // so the two entry points must agree exactly.
    const responses = [wordsForTribe("judah"), wordsForTribe("reuben"), ["Bold"]];
    const viaWords = aggregateObservers(responses);
    const viaProfiles = aggregateProfiles(responses.map((w) => score(w)));
    for (const t of tribes) {
      expect(scoreFor(t.slug, viaProfiles)).toBeCloseTo(scoreFor(t.slug, viaWords));
    }
  });

  it("returns an all-zero profile for no observers", () => {
    expect(aggregateProfiles([]).every((s) => s.score === 0)).toBe(true);
  });
});

describe("isComparisonUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS_TO_UNLOCK - 1)).toBe(false);
  });

  it("unlocks at exactly the minimum and above", () => {
    expect(isComparisonUnlocked(MIN_OBSERVERS_TO_UNLOCK)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS_TO_UNLOCK + 5)).toBe(true);
  });

  it("requires at least three observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });
});
