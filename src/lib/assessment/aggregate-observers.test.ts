import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an others profile for all 12 tribes in canonical order, scored 0–1", () => {
    const { others } = aggregateObservers([["Courageous", "Honorable"]]);
    expect(others).toHaveLength(12);
    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
    for (const o of others) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(1);
    }
  });

  it("reports the number of observers aggregated", () => {
    expect(aggregateObservers([]).count).toBe(0);
    expect(
      aggregateObservers([["Wise"], ["Bold"], ["Nurturing"]]).count,
    ).toBe(3);
  });

  it("scores all-zero with no observers", () => {
    const { others, perObserver } = aggregateObservers([]);
    expect(others.every((o) => o.score === 0)).toBe(true);
    expect(perObserver).toEqual([]);
  });

  it("keeps each observer's individually-normalized profile for drill-down, in order", () => {
    const responses = [["Analytical", "Wise"], ["Courageous"]];
    const { perObserver } = aggregateObservers(responses);
    expect(perObserver).toHaveLength(2);
    // Each drill-down profile is exactly that observer's own normalized score.
    expect(perObserver[0]).toEqual(score(responses[0]));
    expect(perObserver[1]).toEqual(score(responses[1]));
  });

  it("is the equal-weight average of per-observer normalized scores", () => {
    const responses = [
      ["Analytical", "Insightful"],
      ["Courageous", "Honorable"],
      ["Nurturing", "Peaceful"],
    ];
    const { others } = aggregateObservers(responses);
    for (const tribe of tribes) {
      const mean =
        responses.reduce((sum, r) => sum + scoreFor(tribe.slug, score(r)), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean);
    }
  });

  it("counts each observer equally regardless of how many words they picked (not a pooled bag of words)", () => {
    // One observer picks a single word for Issachar; another picks three. A
    // pooled bag of words would give the three-word observer 3× the influence;
    // equal weighting counts each observer once.
    const o1 = ["Analytical"]; // 1 issachar word
    const o2 = ["Insightful", "Learned", "Wise"]; // 3 issachar words
    const { others } = aggregateObservers([o1, o2]);

    const equalWeight =
      (scoreFor("issachar", score(o1)) + scoreFor("issachar", score(o2))) / 2;
    const pooled = scoreFor("issachar", score([...o1, ...o2]));

    expect(scoreFor("issachar", others)).toBeCloseTo(equalWeight);
    expect(scoreFor("issachar", others)).not.toBeCloseTo(pooled);
    // The three-word observer did not drown out the one-word observer.
    expect(pooled).toBeGreaterThan(scoreFor("issachar", others));
  });

  it("does not mutate the input responses", () => {
    const responses = [["Wise"], ["Bold"]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });
});

describe("isComparisonUnlocked", () => {
  it("locks the comparison below the minimum observer count", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
  });

  it("unlocks the comparison at or above the minimum observer count", () => {
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(5)).toBe(true);
  });
});
