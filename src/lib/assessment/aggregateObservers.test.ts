import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

/** Words that map to exactly one tribe (no shared contribution), by slug. */
const soleWordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.length === 1 && w.tribes[0] === slug).map(
    (w) => w.word,
  );

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Two tribes whose words are mostly their own, with differing sole-word counts,
// so an equal-weight average is visibly different from a pooled bag of words.
const BIG = tribes[0].slug; // Judah — the first canonical tribe
const SMALL = tribes[tribes.length - 1].slug; // the last canonical tribe

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const result = aggregateObservers([["Courageous"]]);
    expect(result).toHaveLength(12);
    expect(result.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    expect(result.map((r) => r.name)).toEqual(tribes.map((t) => t.name));
  });

  it("returns an all-zero profile when there are no observers", () => {
    const result = aggregateObservers([]);
    expect(result).toHaveLength(12);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized profile for one observer", () => {
    const words = soleWordsForTribe(BIG).slice(0, 5);
    expect(aggregateObservers([words])).toEqual(score(words));
  });

  it("is the equal-weight mean of each observer's normalized profile", () => {
    const a = soleWordsForTribe(BIG).slice(0, 6);
    const b = soleWordsForTribe(SMALL).slice(0, 3);
    const scoreA = score(a);
    const scoreB = score(b);

    const result = aggregateObservers([a, b]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, scoreA) + scoreFor(tribe.slug, scoreB)) / 2;
      expect(scoreFor(tribe.slug, result)).toBeCloseTo(expected, 10);
    }
  });

  it("weights each observer equally regardless of how many words they picked", () => {
    // Observer A picks many words for BIG; observer B picks few for SMALL.
    const many = soleWordsForTribe(BIG).slice(0, 6);
    const few = soleWordsForTribe(SMALL).slice(0, 2);

    const result = aggregateObservers([many, few]);

    // Each observer contributes exactly half of its own normalized score —
    // the smaller observer is not drowned out by the larger one's word count.
    expect(scoreFor(BIG, result)).toBeCloseTo(
      scoreFor(BIG, score(many)) / 2,
      10,
    );
    expect(scoreFor(SMALL, result)).toBeCloseTo(
      scoreFor(SMALL, score(few)) / 2,
      10,
    );
  });

  it("averages per-observer normalized scores, not a pooled bag of words", () => {
    // Pooling would sum raw points before normalizing, letting the observer who
    // picked more words dominate. Equal-weight averaging must not: build the
    // pooled profile explicitly and assert the aggregate differs from it.
    const many = soleWordsForTribe(BIG).slice(0, 6);
    const few = soleWordsForTribe(SMALL).slice(0, 2);

    const pooled = score([...many, ...few]);
    const equalWeight = aggregateObservers([many, few]);

    // With asymmetric sizes the two approaches disagree on the big tribe.
    expect(scoreFor(BIG, equalWeight)).not.toBeCloseTo(
      scoreFor(BIG, pooled),
      6,
    );
  });

  it("gives identical observers that same profile", () => {
    const words = soleWordsForTribe(BIG).slice(0, 5);
    const one = score(words);
    const result = aggregateObservers([words, words, words]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, result)).toBeCloseTo(
        scoreFor(tribe.slug, one),
        10,
      );
    }
  });
});

describe("isReportUnlocked", () => {
  it("unlocks at the minimum observer count and above", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 1)).toBe(true);
  });

  it("stays locked below the minimum", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });
});
