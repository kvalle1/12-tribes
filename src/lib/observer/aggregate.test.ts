import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 others profile for all 12 tribes in canonical order", () => {
    const { others } = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("is the equal-weight average of each observer's individually-normalized score", () => {
    const responses = [["Courageous"], wordsForTribe("levi"), ["Bold", "Zealous"]];
    const { others, perObserver } = aggregateObservers(responses);

    // Every tribe's "others" score is the plain mean of the per-observer scores.
    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, obs) => sum + scoreFor(tribe.slug, obs), 0) /
        perObserver.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean);
    }
  });

  it("averages per-observer scores rather than pooling everyone's words", () => {
    // Observer A: a single Judah-only word. Observer B: full Levi coverage.
    const responses = [["Courageous"], wordsForTribe("levi")];
    const { others } = aggregateObservers(responses);

    // Equal-weight average: Levi's 1.0 from B, halved across two observers.
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);

    // Pooling all words into one score would instead leave Levi at a full 1.0,
    // letting the observer who picked more words dominate — which we reject.
    const pooled = score(["Courageous", ...wordsForTribe("levi")]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", others)).not.toBeCloseTo(scoreFor("levi", pooled));
  });

  it("gives every observer equal influence regardless of how many words they pick", () => {
    // Issachar has 10 words, Levi has 6. Each observer maxes out one tribe.
    const responses = [wordsForTribe("issachar"), wordsForTribe("levi")];
    const { others } = aggregateObservers(responses);

    // Despite Issachar's observer selecting more words, both land at exactly 0.5:
    // word count buys no extra influence (ADR-0003).
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
  });

  it("exposes each observer's normalized profile for anonymous drill-down", () => {
    const responses = [["Courageous"], ["Bold"], wordsForTribe("levi")];
    const { perObserver } = aggregateObservers(responses);

    expect(perObserver).toHaveLength(3);
    // Each entry is exactly the individual score of that observer's words —
    // in submission order, carrying only tribe scores (no observer identity).
    perObserver.forEach((profile, i) => {
      expect(profile).toEqual(score(responses[i]));
      for (const entry of profile) {
        expect(Object.keys(entry).sort()).toEqual(["name", "score", "slug"]);
      }
    });
  });

  it("locks below the threshold and unlocks at it", () => {
    const two = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(two.observerCount).toBe(2);
    expect(two.unlocked).toBe(false);

    const three = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(three.observerCount).toBe(3);
    expect(three.unlocked).toBe(true);
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });

  it("handles no observers as an all-zero, locked profile", () => {
    const { others, perObserver, observerCount, unlocked } =
      aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(unlocked).toBe(false);
    expect(perObserver).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });
});
