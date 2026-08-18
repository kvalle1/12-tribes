import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  isObserverReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** A valid-length selection (8–15 words) skewed toward a single tribe. */
const selectionForTribe = (slug: string) => {
  const own = wordsForTribe(slug);
  // Pad with other words if needed to reach a realistic multi-word selection,
  // but keep it dominated by `slug`.
  return own.slice(0, Math.max(8, Math.min(own.length, 12)));
};

describe("aggregateObservers", () => {
  it("returns a zeroed 12-tribe table and no observers for an empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("scores each observer individually and keeps them in input order", () => {
    const r1 = selectionForTribe(tribes[0].slug);
    const r2 = selectionForTribe(tribes[1].slug);
    const agg = aggregateObservers([r1, r2]);

    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(r1));
    expect(agg.perObserver[1]).toEqual(score(r2));
  });

  it("returns the equal-weight average of the per-observer normalized scores", () => {
    const r1 = selectionForTribe(tribes[0].slug);
    const r2 = selectionForTribe(tribes[1].slug);
    const r3 = selectionForTribe(tribes[2].slug);
    const responses = [r1, r2, r3];
    const agg = aggregateObservers(responses);

    for (const tribe of tribes) {
      const expected =
        responses.reduce((sum, r) => sum + scoreFor(tribe.slug, score(r)), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(expected, 10);
    }
  });

  it("weights observers equally regardless of how many words each picked", () => {
    // Two observers describe the SAME tribe, but one picks many more words. Since
    // each observer is normalized before averaging, the wordier observer must not
    // dominate — the average equals each observer's own (identical-shape) score,
    // not a pooled bag of words tilted toward the wordier one.
    const target = tribes[0].slug;
    const all = wordsForTribe(target);
    const few = all.slice(0, 8);
    const many = all.slice(0, Math.min(all.length, 15));

    const agg = aggregateObservers([few, many]);
    const avgOfIndividuals = tribes.map(
      (t) =>
        (scoreFor(t.slug, score(few)) + scoreFor(t.slug, score(many))) / 2,
    );

    tribes.forEach((t, i) => {
      expect(scoreFor(t.slug, agg.others)).toBeCloseTo(avgOfIndividuals[i], 10);
    });
  });

  it("keeps the aggregate scores within 0–1 like the underlying scoring core", () => {
    const responses = tribes
      .slice(0, 4)
      .map((t) => selectionForTribe(t.slug));
    const agg = aggregateObservers(responses);
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("isObserverReportUnlocked", () => {
  it(`unlocks only at ${MIN_OBSERVERS_FOR_REPORT} or more observers`, () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isObserverReportUnlocked(0)).toBe(false);
    expect(isObserverReportUnlocked(2)).toBe(false);
    expect(isObserverReportUnlocked(3)).toBe(true);
    expect(isObserverReportUnlocked(5)).toBe(true);
  });
});
