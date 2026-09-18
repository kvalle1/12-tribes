import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS,
  aggregateObservers,
  isComparisonUnlocked,
} from "./aggregate";

/**
 * Behavioral tests for the equal-weight observer aggregation (issue #9,
 * ADR-0003). The invariant that matters: the "others" profile is the mean of
 * each observer's *individually-normalized* scores, so an observer who selects
 * more words never gains more influence — it is not a pooled bag of words.
 */

// Judah-only words (each maps to judah alone), so this observer touches exactly
// one tribe and we can reason about its contribution precisely.
const JUDAH_WORDS = ["Authoritative", "Courageous", "Honorable"];

// A deliberately larger selection that avoids judah entirely (dan / issachar /
// asher only), so word-count influence — if any leaked in — would show up.
const NON_JUDAH_WORDS = [
  "Alert",
  "Watchful",
  "Vigilant",
  "Skeptical",
  "Learned",
  "Wise",
  "Patient",
  "Peaceful",
  "Nurturing",
  "Welcoming",
];

function scoreBySlug(words: readonly string[]): Record<string, number> {
  return Object.fromEntries(score(words).map((s) => [s.slug, s.score]));
}

describe("aggregateObservers", () => {
  it("reports the number of observer responses", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(aggregateObservers([JUDAH_WORDS]).observerCount).toBe(1);
    expect(
      aggregateObservers([JUDAH_WORDS, NON_JUDAH_WORDS, JUDAH_WORDS])
        .observerCount,
    ).toBe(3);
  });

  it("returns every tribe once, in canonical order", () => {
    const { average } = aggregateObservers([JUDAH_WORDS, NON_JUDAH_WORDS]);
    expect(average.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("for a single observer, the average is that observer's normalized score", () => {
    const { average } = aggregateObservers([JUDAH_WORDS]);
    const expected = scoreBySlug(JUDAH_WORDS);
    for (const row of average) {
      expect(row.score).toBeCloseTo(expected[row.slug], 10);
    }
  });

  it("averages the per-observer normalized scores (equal weight, not pooled)", () => {
    const { average } = aggregateObservers([JUDAH_WORDS, NON_JUDAH_WORDS]);
    const a = scoreBySlug(JUDAH_WORDS);
    const b = scoreBySlug(NON_JUDAH_WORDS);
    for (const row of average) {
      expect(row.score).toBeCloseTo((a[row.slug] + b[row.slug]) / 2, 10);
    }
  });

  it("gives a word-heavy observer no more influence than a word-light one", () => {
    // Observer A picks 3 words (all judah); observer B picks 10 words (no
    // judah). Each must count for exactly half — B's larger count buys nothing.
    const { average } = aggregateObservers([JUDAH_WORDS, NON_JUDAH_WORDS]);
    const bySlug = Object.fromEntries(average.map((t) => [t.slug, t.score]));
    const a = scoreBySlug(JUDAH_WORDS);
    const b = scoreBySlug(NON_JUDAH_WORDS);

    // A's judah signal survives at half weight...
    expect(bySlug["judah"]).toBeCloseTo(a["judah"] / 2, 10);
    expect(bySlug["judah"]).toBeGreaterThan(0);
    // ...and B's dan signal likewise, despite B having many more words.
    expect(bySlug["dan"]).toBeCloseTo(b["dan"] / 2, 10);
    expect(bySlug["dan"]).toBeGreaterThan(0);

    // A pooled "bag of words" would instead give each tribe its full,
    // un-halved score — so the equal-weight average must differ from pooling.
    const pooled = scoreBySlug([...JUDAH_WORDS, ...NON_JUDAH_WORDS]);
    expect(bySlug["judah"]).not.toBeCloseTo(pooled["judah"], 10);
  });

  it("exposes each observer's own normalized scores for anonymous drill-down", () => {
    const responses = [JUDAH_WORDS, NON_JUDAH_WORDS];
    const { perObserver } = aggregateObservers(responses);
    expect(perObserver).toHaveLength(responses.length);
    perObserver.forEach((observer, i) => {
      expect(observer.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
      const expected = scoreBySlug(responses[i]);
      for (const row of observer) {
        expect(row.score).toBeCloseTo(expected[row.slug], 10);
      }
    });
  });

  it("handles no observers without dividing by zero", () => {
    const { observerCount, average, perObserver } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(average.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(average.every((t) => t.score === 0)).toBe(true);
  });
});

describe("isComparisonUnlocked", () => {
  it("locks the report until at least MIN_OBSERVERS have responded", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
