import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("isComparisonUnlocked", () => {
  it("unlocks at the 3-observer floor (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(5)).toBe(true);
  });
});

describe("scoreObservers", () => {
  it("scores each observer individually in canonical tribe order", () => {
    const perObserver = scoreObservers([["Courageous"], ["Bold"]]);
    expect(perObserver).toHaveLength(2);
    for (const profile of perObserver) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Each observer's profile is exactly that observer's own normalized score.
    expect(perObserver[0]).toEqual(score(["Courageous"]));
    expect(perObserver[1]).toEqual(score(["Bold"]));
  });

  it("returns no profiles for no observers", () => {
    expect(scoreObservers([])).toEqual([]);
  });
});

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero when there are no observers", () => {
    const others = aggregateObservers([]);
    expect(others).toHaveLength(12);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals that observer's own score for a single observer", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    expect(aggregateObservers([words])).toEqual(score(words));
  });

  it("is the equal-weight mean of each observer's normalized score", () => {
    const a = ["Courageous"];
    const b = wordsForTribe("judah");
    const others = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked (not a pooled bag of words)", () => {
    // One observer picks a single judah word; the other picks ALL judah words.
    // Equal-weight averaging must NOT let the many-word observer dominate the
    // way a pooled "bag of words" (scoring the concatenation) would.
    const few = ["Courageous"];
    const many = wordsForTribe("judah");

    const equalWeight = scoreFor("judah", aggregateObservers([few, many]));
    const pooled = scoreFor("judah", score([...few, ...many]));

    // The two observers' judah scores straddle the pooled score, so the
    // equal-weight mean sits strictly below the pooled (effort-weighted) value.
    expect(equalWeight).toBeLessThan(pooled);
    expect(equalWeight).toBeCloseTo(
      (scoreFor("judah", score(few)) + scoreFor("judah", score(many))) / 2,
    );
  });

  it("is unaffected by the order observers are supplied in", () => {
    const a = ["Courageous"];
    const b = ["Bold"];
    const c = wordsForTribe("levi");
    const forward = aggregateObservers([a, b, c]);
    const reversed = aggregateObservers([c, b, a]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, forward)).toBeCloseTo(
        scoreFor(tribe.slug, reversed),
      );
    }
  });
});
