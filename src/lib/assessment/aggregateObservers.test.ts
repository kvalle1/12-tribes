import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero others profile and no observers for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
    expect(agg.others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer individually and keeps them in input order", () => {
    const responses = [wordsForTribe("levi"), wordsForTribe("judah")];
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    // Each per-observer profile matches scoring that observer alone.
    expect(agg.perObserver[0]).toEqual(score(responses[0]));
    expect(agg.perObserver[1]).toEqual(score(responses[1]));
  });

  it("averages each observer's normalized score with equal weight", () => {
    // Observer A maxes out Levi (normalized 1.0 for levi), Observer B maxes out
    // Judah. The equal-weight others profile is the mean of the two normalized
    // profiles, so levi and judah each land at 0.5 — neither dominates.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("judah"),
    ]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(0.5);
  });

  it("weights observers equally regardless of how many words they picked", () => {
    // Both observers point entirely at Levi, but one picks all of Levi's words
    // (normalized score 1.0) and the other picks a single Levi word (a smaller
    // normalized score). Equal-weight averaging means the aggregate is the mean
    // of the two normalized scores — the many-word observer does NOT gain more
    // influence, which is exactly what pooling raw words would wrongly do.
    const allLevi = wordsForTribe("levi");
    const oneLeviWord = [allLevi[0]];

    const equalWeight = aggregateObservers([allLevi, oneLeviWord]);
    const expected =
      (scoreFor("levi", score(allLevi)) +
        scoreFor("levi", score(oneLeviWord))) /
      2;
    expect(scoreFor("levi", equalWeight.others)).toBeCloseTo(expected);

    // Sanity: this is NOT the same as pooling both observers' words into one bag
    // and scoring that (which would over-count the heavy observer's coverage).
    const pooled = scoreFor("levi", score([...allLevi, ...oneLeviWord]));
    expect(scoreFor("levi", equalWeight.others)).not.toBeCloseTo(pooled);
  });

  it("a single observer's others profile equals that observer's own scores", () => {
    const words = wordsForTribe("issachar");
    const agg = aggregateObservers([words]);
    expect(agg.others).toEqual(score(words));
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks the report at and above the minimum observer count", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 5)).toBe(true);
  });

  it("requires at least three observers by default (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
