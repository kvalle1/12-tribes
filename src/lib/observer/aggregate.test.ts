import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug (a full-coverage selection scores 1.0). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero for no observers", () => {
    expect(aggregateObservers([]).every((s) => s.score === 0)).toBe(true);
  });

  it("equals the observer's own profile when there is exactly one observer", () => {
    const words = wordsForTribe("levi");
    const others = aggregateObservers([words]);
    const own = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, own));
    }
  });

  it("is the element-wise mean of each observer's individually-normalized scores (not a pooled bag of words)", () => {
    const a = wordsForTribe("levi"); // full levi coverage
    const b = ["Courageous"]; // judah-only single word
    const others = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // Observer A fills levi with its 6 words; observer B fills issachar with its
    // 10 words. Each maxes out their own tribe (normalized 1.0), so an
    // equal-weight average puts both at exactly 0.5 — the larger selection buys
    // no extra influence.
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");
    expect(a.length).not.toBe(b.length); // different word counts on purpose
    const others = aggregateObservers([a, b]);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
  });

  it("ignores unknown words, inheriting the scoring core's exact-match contract", () => {
    const withJunk = aggregateObservers([["notaword", "Courageous"]]);
    const clean = aggregateObservers([["Courageous"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, withJunk)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });
});

describe("isReportUnlocked", () => {
  it("unlocks only at or above the threshold of 3 observers", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});
