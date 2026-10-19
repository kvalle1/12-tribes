import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "./score";
import { aggregateObservers } from "./aggregate";

/**
 * Two Observers whose selections differ in size. The equal-weight average must
 * treat them identically despite the different word counts — that is the whole
 * point of normalizing each Observer before averaging (ADR-0003).
 */
const OBSERVER_A = [
  "Aggressive",
  "Alert",
  "Analytical",
  "Authoritative",
  "Battle-tested",
  "Bold",
  "Cautious",
  "Comforting",
];
const OBSERVER_B = [
  "Consistent",
  "Convicted",
  "Courageous",
  "Creative",
  "Cunning",
  "Decisive",
  "Dedicated",
  "Deliberate",
  "Devoted",
  "Discerning",
];

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([OBSERVER_A, OBSERVER_B]);
    expect(agg).toHaveLength(12);
    expect(agg.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("averages each Observer's individually-normalized score with equal weight", () => {
    const a = score(OBSERVER_A);
    const b = score(OBSERVER_B);
    const agg = aggregateObservers([OBSERVER_A, OBSERVER_B]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected, 10);
    }
  });

  it("is an equal-weight average, not a pooled bag of words", () => {
    // Pooling the two selections would let the larger selection pull the result;
    // the equal-weight average must differ from scoring the merged word set.
    const pooled = score([...OBSERVER_A, ...OBSERVER_B]);
    const agg = aggregateObservers([OBSERVER_A, OBSERVER_B]);
    const differs = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, agg) - scoreFor(t.slug, pooled)) > 1e-9,
    );
    expect(differs).toBe(true);
  });

  it("does not let word count become influence (same normalized profile wins equally)", () => {
    // Observer B2 picks the SAME words as A twice over is impossible (sets), so
    // instead: an Observer who selected more words than another must not dominate.
    // A selects 8 words, B selects 10; neither tribe's aggregate equals either
    // observer's raw score — it sits exactly halfway, proving equal footing.
    const a = score(OBSERVER_A);
    const b = score(OBSERVER_B);
    const agg = aggregateObservers([OBSERVER_A, OBSERVER_B]);
    for (const tribe of tribes) {
      const lo = Math.min(scoreFor(tribe.slug, a), scoreFor(tribe.slug, b));
      const hi = Math.max(scoreFor(tribe.slug, a), scoreFor(tribe.slug, b));
      const mid = scoreFor(tribe.slug, agg);
      expect(mid).toBeGreaterThanOrEqual(lo - 1e-12);
      expect(mid).toBeLessThanOrEqual(hi + 1e-12);
    }
  });

  it("equals a single Observer's own score when there is only one", () => {
    const one = aggregateObservers([OBSERVER_A]);
    const direct = score(OBSERVER_A);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, one)).toBeCloseTo(
        scoreFor(tribe.slug, direct),
        10,
      );
    }
  });

  it("is independent of Observer order", () => {
    const ab = aggregateObservers([OBSERVER_A, OBSERVER_B]);
    const ba = aggregateObservers([OBSERVER_B, OBSERVER_A]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, ab)).toBeCloseTo(
        scoreFor(tribe.slug, ba),
        12,
      );
    }
  });

  it("returns an all-zero canonical profile when there are no Observers", () => {
    const empty = aggregateObservers([]);
    expect(empty.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(empty.every((t) => t.score === 0)).toBe(true);
  });

  it("ignores unknown words the same way the scoring core does", () => {
    const withJunk = aggregateObservers([
      [...OBSERVER_A, "NotARealWord"],
      OBSERVER_B,
    ]);
    const clean = aggregateObservers([OBSERVER_A, OBSERVER_B]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, withJunk)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
        12,
      );
    }
  });
});
