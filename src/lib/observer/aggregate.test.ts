import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero with no responses (the locked-state baseline)", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("equals the observer's own score for a single response", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers([words]);
    expect(agg).toEqual(score(words));
  });

  it("averages per-observer normalized profiles with equal weight", () => {
    // Observer A picks a judah-only word (judah = full point for A).
    // Observer B picks a levi-only set (levi = full point for B).
    // The equal-weight average puts each at exactly half.
    const agg = aggregateObservers([["Courageous"], wordsForTribe("levi")]);
    const soloJudah = scoreFor("judah", score(["Courageous"]));
    const fullLevi = scoreFor("levi", score(wordsForTribe("levi")));
    expect(scoreFor("judah", agg)).toBeCloseTo(soloJudah / 2);
    expect(scoreFor("levi", agg)).toBeCloseTo(fullLevi / 2);
  });

  it("does not let an observer who picks more words gain more influence", () => {
    // Issachar has 10 words, Levi 6. Each observer maxes out their own tribe
    // (normalized 1.0) — despite the 10-vs-6 word gap they land equal (0.5
    // each) in the aggregate. A pooled bag of words would skew toward the
    // 10-word observer; equal-weight averaging of finished profiles does not.
    const issacharObs = wordsForTribe("issachar");
    const leviObs = wordsForTribe("levi");
    expect(issacharObs.length).toBeGreaterThan(leviObs.length);

    const agg = aggregateObservers([issacharObs, leviObs]);
    expect(scoreFor("issachar", agg)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg)).toBeCloseTo(scoreFor("levi", agg));
  });

  it("is an average, not a sum — repeated identical observers do not inflate", () => {
    const one = aggregateObservers([["Courageous"]]);
    const three = aggregateObservers([
      ["Courageous"],
      ["Courageous"],
      ["Courageous"],
    ]);
    expect(scoreFor("judah", three)).toBeCloseTo(scoreFor("judah", one));
  });

  it("is order-independent (aggregation is commutative)", () => {
    const a = aggregateObservers([["Courageous"], wordsForTribe("levi")]);
    const b = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    expect(a).toEqual(b);
  });

  it("keeps every tribe score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      ["Bold", "Zealous"],
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at or above the minimum", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
