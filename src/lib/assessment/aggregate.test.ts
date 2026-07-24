import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const mean = (nums: number[]) =>
  nums.reduce((sum, n) => sum + n, 0) / nums.length;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 'others' profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("is the equal-weight per-tribe mean of each observer's normalized profile", () => {
    const responses = [
      wordsForTribe("judah"),
      [...wordsForTribe("levi"), "Courageous"],
      wordsForTribe("issachar"),
    ];
    const agg = aggregateObservers(responses);
    const perObserver = responses.map((r) => score(r));
    for (const tribe of tribes) {
      const expected = mean(perObserver.map((p) => scoreFor(tribe.slug, p)));
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(expected);
    }
  });

  it("weights each observer equally regardless of how many words they picked (not a pooled bag of words)", () => {
    const many = wordsForTribe("judah"); // full judah coverage, lots of words → judah 1.0
    const few = ["Courageous"]; // a single judah word → small judah score

    const agg = aggregateObservers([many, few]);
    const judahOthers = scoreFor("judah", agg.others);

    const judahMany = scoreFor("judah", score(many));
    const judahFew = scoreFor("judah", score(few));
    // Equal weight: the big selection contributes exactly one observer's worth.
    expect(judahOthers).toBeCloseTo((judahMany + judahFew) / 2);

    // A pooled bag of words would let the larger selection dominate — the two
    // must differ, proving we average per-observer rather than pool words.
    const pooled = scoreFor("judah", score([...many, ...few]));
    expect(judahOthers).not.toBeCloseTo(pooled);
  });

  it("exposes each observer's individual normalized profile for anonymous drill-down", () => {
    const responses = [wordsForTribe("judah"), wordsForTribe("levi")];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(2);
    expect(scoreFor("judah", agg.perObserver[0])).toBeCloseTo(1);
    expect(scoreFor("levi", agg.perObserver[1])).toBeCloseTo(1);
    // Each per-observer profile matches scoring that observer alone.
    expect(agg.perObserver[0]).toEqual(score(responses[0]));
  });

  it("reports the observer count", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([wordsForTribe("judah"), wordsForTribe("levi")])
        .observerCount,
    ).toBe(2);
  });

  it("returns an all-zero 'others' profile and no observers for an empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own profile when only one has responded", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers([words]);
    expect(agg.others).toEqual(score(words));
  });
});

describe("isComparisonUnlocked", () => {
  it("locks the report below the minimum observer count", () => {
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks the report at and above the minimum observer count", () => {
    expect(isComparisonUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });

  it("keeps the minimum at 3 (ADR-0003 anonymity + meaningful average)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
