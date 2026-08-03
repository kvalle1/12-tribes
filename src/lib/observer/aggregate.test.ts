import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Four judah-only words and one levi-only word — used to contrast equal-weight
// averaging against a pooled bag of words.
const HEAVY_JUDAH = ["Courageous", "Honorable", "Sacrificial", "Authoritative"];
const LIGHT_JUDAH = ["Courageous"];
const ONE_LEVI = ["Dedicated"];

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([HEAVY_JUDAH, ONE_LEVI]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("yields an all-zero profile for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own scores when only one responded", () => {
    const words = ["Bold", "Wise", "Loyal"];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("is the equal-weight mean of each observer's individually-normalized vector", () => {
    const a = ["Courageous", "Honorable"]; // judah
    const b = ["Dedicated"]; // levi
    const agg = aggregateObservers([a, b]);
    const sA = score(a);
    const sB = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sA) + scoreFor(tribe.slug, sB)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // One observer floods judah with four words, another picks a single judah
    // word. Equal-weight averaging counts each observer once: the aggregate is
    // the mean of their two normalized judah scores, NOT weighted by word count.
    const agg = aggregateObservers([HEAVY_JUDAH, LIGHT_JUDAH]);
    const heavy = scoreFor("judah", score(HEAVY_JUDAH));
    const light = scoreFor("judah", score(LIGHT_JUDAH));
    expect(scoreFor("judah", agg)).toBeCloseTo((heavy + light) / 2);
  });

  it("is not a pooled bag of words (word count never becomes influence)", () => {
    // Pooling both observers' words and scoring once would let the four-word
    // observer dominate the one-word observer. Equal-weight aggregation must
    // differ from that pooled score.
    const agg = aggregateObservers([HEAVY_JUDAH, ONE_LEVI]);
    const pooled = score([...HEAVY_JUDAH, ...ONE_LEVI]);

    // The lone levi observer keeps full half-weight: others' levi is half of the
    // pooled levi, not diluted by the four judah words in the pool.
    expect(scoreFor("levi", agg)).toBeCloseTo(scoreFor("levi", pooled) / 2);
    expect(scoreFor("levi", agg)).not.toBeCloseTo(scoreFor("levi", pooled));
  });
});

describe("scoreObservers", () => {
  it("scores each observer independently, preserving order and count", () => {
    const responses = [["Bold"], ["Dedicated", "Precise"]];
    const perObserver = scoreObservers(responses);
    expect(perObserver).toHaveLength(2);
    for (let i = 0; i < responses.length; i++) {
      const solo = score(responses[i]);
      for (const tribe of tribes) {
        expect(scoreFor(tribe.slug, perObserver[i])).toBeCloseTo(
          scoreFor(tribe.slug, solo),
        );
      }
    }
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below the threshold and unlocks at or above it", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(1)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(4)).toBe(true);
  });
});
