import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  type ObserverResponse,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const response = (words: string[]): ObserverResponse => ({ words });

describe("aggregateObservers", () => {
  it("reports the number of contributing observers", () => {
    const agg = aggregateObservers([
      response(["Courageous"]),
      response(["Analytical"]),
    ]);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
  });

  it("returns an all-zero average in canonical order when there are no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the single observer's own profile as the average when only one responds", () => {
    const words = ["Courageous", "Analytical", "Strategic"];
    const agg = aggregateObservers([response(words)]);
    const solo = score(words);
    expect(agg.average).toEqual(solo);
    expect(agg.perObserver[0]).toEqual(solo);
  });

  it("averages per-observer normalized scores — NOT a pooled bag of words", () => {
    // Observer A maxes Issachar (10 words → normalized 1.0 for issachar).
    // Observer B maxes Levi (6 words → normalized 1.0 for levi).
    // Equal weight: each tribe is lifted by exactly one observer, so both land
    // at (1.0 + 0) / 2 = 0.5 — DESPITE the 10-vs-6 word-count disparity. A
    // pooled-words approach would not produce this symmetric 0.5/0.5 result.
    const agg = aggregateObservers([
      response(wordsForTribe("issachar")),
      response(wordsForTribe("levi")),
    ]);
    expect(scoreFor("issachar", agg.average)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5);
  });

  it("counts each observer once (1/N) rather than pooling their words", () => {
    // Observer A picks a single judah-only word; Observer B maxes issachar with
    // ten words. Each observer is scored on its own and averaged 1/N, so
    // issachar — which only B scored — averages to exactly 0.5, not the ~1.0 a
    // pooled scoring would give the word-heavy observer.
    const light = ["Courageous"]; // judah-only, one word
    const heavy = wordsForTribe("issachar"); // ten words
    const agg = aggregateObservers([response(light), response(heavy)]);

    expect(scoreFor("issachar", agg.average)).toBeCloseTo(0.5);
    expect(scoreFor("judah", agg.average)).toBeCloseTo(
      scoreFor("judah", score(light)) / 2,
    );
  });

  it("averages identical observers to that same profile", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const agg = aggregateObservers([response(words), response(words)]);
    expect(agg.average).toEqual(score(words));
  });

  it("preserves each observer's own normalized profile for anonymous drill-down", () => {
    const a = ["Courageous", "Bold"];
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([response(a), response(b)]);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    for (const profile of agg.perObserver) {
      expect(profile).toHaveLength(12);
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("keeps the average on the same 0–1 scale as a self profile", () => {
    const agg = aggregateObservers([
      response(wordsForTribe("judah")),
      response(wordsForTribe("dan")),
      response(wordsForTribe("asher")),
    ]);
    expect(agg.average).toHaveLength(12);
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("unlocks at three observers", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
