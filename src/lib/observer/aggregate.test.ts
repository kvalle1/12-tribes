import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS_TO_UNLOCK,
  aggregateObservers,
  isComparisonUnlocked,
  scoreEachObserver,
} from "./aggregate";

/** Pull one tribe's score out of a canonical-order TribeScore[] by slug. */
function by(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

// Single-tribe words from the catalog, chosen so each selection's scoring is
// easy to reason about (no shared-word 1/N splitting in play).
const TWO_JUDAH = { words: ["Authoritative", "Courageous"] }; // both → judah
const ONE_REUBEN = { words: ["Energetic"] }; // → reuben

describe("aggregateObservers", () => {
  it("returns a score for all twelve tribes in canonical order", () => {
    const result = aggregateObservers([ONE_REUBEN]);
    expect(result.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is all zeros when there are no observer responses", () => {
    const result = aggregateObservers([]);
    expect(result).toHaveLength(tribes.length);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  it("equals that observer's own normalized score for a single observer", () => {
    const result = aggregateObservers([TWO_JUDAH]);
    const self = score(TWO_JUDAH.words);
    for (const tribe of tribes) {
      expect(by(result, tribe.slug)).toBeCloseTo(by(self, tribe.slug), 10);
    }
  });

  it("averages per-observer normalized scores with equal weight, not a pooled bag of words", () => {
    const scoreA = score(TWO_JUDAH.words); // observer with MORE words (both judah)
    const scoreB = score(ONE_REUBEN.words); // observer with FEWER words (reuben)

    const agg = aggregateObservers([TWO_JUDAH, ONE_REUBEN]);

    // Equal weight: each observer contributes exactly half, regardless of how
    // many words they picked.
    expect(by(agg, "judah")).toBeCloseTo(by(scoreA, "judah") / 2, 10);
    expect(by(agg, "reuben")).toBeCloseTo(by(scoreB, "reuben") / 2, 10);

    // Pooling (scoring the union of all words) would instead give the
    // many-word observer full, undiluted influence — the thing equal-weight
    // averaging exists to prevent. Confirm the aggregate is NOT that.
    const pooled = score([...TWO_JUDAH.words, ...ONE_REUBEN.words]);
    expect(by(pooled, "judah")).toBeCloseTo(by(scoreA, "judah"), 10);
    expect(by(agg, "judah")).not.toBeCloseTo(by(pooled, "judah"), 5);
  });

  it("gives every observer the same weight even when word counts differ wildly", () => {
    // Observer A selects judah words twice over; Observer B selects one reuben
    // word. A's extra words must not buy judah more than half the aggregate.
    const many = { words: ["Authoritative", "Courageous"] };
    const few = { words: ["Energetic"] };
    const agg = aggregateObservers([many, few]);

    expect(by(agg, "judah")).toBeCloseTo(by(score(many.words), "judah") / 2, 10);
    expect(by(agg, "reuben")).toBeCloseTo(by(score(few.words), "reuben") / 2, 10);
  });
});

describe("scoreEachObserver", () => {
  it("returns each observer's individually-normalized scores, in order", () => {
    const each = scoreEachObserver([TWO_JUDAH, ONE_REUBEN]);
    expect(each).toHaveLength(2);
    expect(each[0]).toEqual(score(TWO_JUDAH.words));
    expect(each[1]).toEqual(score(ONE_REUBEN.words));
  });

  it("is empty for no responses", () => {
    expect(scoreEachObserver([])).toEqual([]);
  });
});

describe("isComparisonUnlocked", () => {
  it("unlocks only at or above the minimum observer count", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(4)).toBe(true);
  });
});
