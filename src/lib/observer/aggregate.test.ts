import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, scoreObservers } from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("scoreObservers", () => {
  it("scores each response individually, in input order (Observer 1 = index 0)", () => {
    const perObserver = scoreObservers([["Courageous"], []]);
    expect(perObserver).toHaveLength(2);
    // Each entry is a full 12-tribe normalized profile.
    for (const profile of perObserver) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Observer 1 (index 0) picked a judah word; Observer 2 picked nothing.
    expect(scoreFor("judah", perObserver[0])).toBeGreaterThan(0);
    expect(perObserver[1].every((s) => s.score === 0)).toBe(true);
  });
});

describe("aggregateObservers", () => {
  it("returns a 12-tribe profile in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns an all-zero profile for no responses (never divides by zero)", () => {
    const agg = aggregateObservers([]);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single profile when one observer responds", () => {
    const single = score(["Courageous"]);
    const agg = aggregateObservers([["Courageous"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, single));
    }
  });

  it("averages identical observers to that same profile", () => {
    const one = scoreFor("judah", score(["Courageous"]));
    const agg = aggregateObservers([["Courageous"], ["Courageous"]]);
    expect(scoreFor("judah", agg)).toBeCloseTo(one);
  });

  it("is the equal-weight average of per-observer normalized scores", () => {
    const judahOne = scoreFor("judah", score(["Courageous"]));
    const judahAll = scoreFor("judah", score(wordsForTribe("judah")));
    const agg = aggregateObservers([["Courageous"], wordsForTribe("judah")]);
    expect(scoreFor("judah", agg)).toBeCloseTo((judahOne + judahAll) / 2);
  });

  it("gives every observer equal influence regardless of word count (not a pooled bag of words)", () => {
    // Observer A picks one judah word; Observer B picks all of judah's words.
    // Equal-weight averages the two normalized profiles, so judah lands strictly
    // between the small and full scores. A pooled bag of words would instead
    // dedupe to judah's full coverage and read the maximum — the thing ADR-0003
    // rejects so that effort (word count) never becomes influence.
    const judahOne = scoreFor("judah", score(["Courageous"]));
    const pooled = scoreFor(
      "judah",
      score(["Courageous", ...wordsForTribe("judah")]),
    );
    const agg = scoreFor(
      "judah",
      aggregateObservers([["Courageous"], wordsForTribe("judah")]),
    );
    expect(agg).toBeGreaterThan(judahOne);
    expect(agg).toBeLessThan(pooled);
  });

  it("does not depend on the order of observers", () => {
    const a = aggregateObservers([["Courageous"], wordsForTribe("levi")]);
    const b = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, a)).toBeCloseTo(scoreFor(tribe.slug, b));
    }
  });

  it("keeps every averaged score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});
