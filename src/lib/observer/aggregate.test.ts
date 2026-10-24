import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreEachObserver,
  hasEnoughObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("scoreEachObserver", () => {
  it("scores each observer independently with the shared core", () => {
    const responses = [["Courageous"], wordsForTribe("levi")];
    const per = scoreEachObserver(responses);
    expect(per).toHaveLength(2);
    // Each observer's vector is exactly what the Self scoring core produces.
    expect(per[0]).toEqual(score(["Courageous"]));
    expect(per[1]).toEqual(score(wordsForTribe("levi")));
  });

  it("returns an empty list for no observers", () => {
    expect(scoreEachObserver([])).toEqual([]);
  });
});

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own profile when only one responded", () => {
    const words = ["Courageous", "Bold"];
    expect(aggregateObservers([words])).toEqual(score(words));
  });

  it("is the equal-weight mean of each observer's normalized score", () => {
    const a = wordsForTribe("levi");
    const b = ["Courageous"]; // judah-only
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    // Every tribe's aggregate is the simple mean of the two observers' scores.
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal say — it does not pool their words", () => {
    // Observer A picks many words (all of Levi's → levi = 1.0); Observer B picks
    // a single judah word. Equal-weight averaging halves Levi to 0.5 because B
    // gets a full, equal vote. Pooling all words into one score() would instead
    // keep Levi at 1.0, since A's sheer volume would dominate — the exact
    // failure mode this aggregation must avoid (ADR-0003).
    const a = wordsForTribe("levi");
    const b = ["Courageous"];
    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1.0);
    expect(scoreFor("levi", agg)).not.toBeCloseTo(scoreFor("levi", pooled));
  });

  it("keeps every score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("judah"),
      ["Courageous", "Bold", "Zealous"],
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at three or more responses", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
