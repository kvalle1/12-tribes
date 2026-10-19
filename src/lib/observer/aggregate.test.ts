import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  type ObserverAggregate,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns all-zero averages and no drill-down for zero observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });

  it("reports every tribe in canonical order with scores within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous"],
      ["Bold"],
    ]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns the equal-weight average of per-observer normalized scores, not a pooled bag of words", () => {
    const prolific = wordsForTribe("levi"); // one observer picks every levi word
    const sparse = ["Courageous"]; // another picks a single judah word
    const agg = aggregateObservers([prolific, sparse]);

    const a = score(prolific);
    const b = score(sparse);
    // Every tribe's "others" score is the arithmetic mean of the two observers'
    // individually-normalized scores for that tribe.
    for (let i = 0; i < agg.average.length; i++) {
      expect(agg.average[i].score).toBeCloseTo((a[i].score + b[i].score) / 2);
    }

    // And that mean is NOT what you'd get by pooling both word lists and scoring
    // them together — the distinction the whole aggregation exists to make.
    const pooled = score([...prolific, ...sparse]);
    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5); // (1.0 + 0) / 2
    expect(scoreFor("levi", pooled)).toBeCloseTo(1.0); // full levi coverage survives pooling
  });

  it("gives each observer equal influence regardless of how many words they pick", () => {
    // Observer A fully covers levi with many words (levi → 1.0); observer B picks
    // a single, unrelated word. A's volume does not let it weigh more than one
    // observer: levi lands at exactly 0.5, the mean of 1.0 and 0.
    const agg = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5);
  });

  it("stays locked below the 3-observer threshold", () => {
    expect(aggregateObservers([]).unlocked).toBe(false);
    expect(aggregateObservers([["Courageous"]]).unlocked).toBe(false);
    expect(aggregateObservers([["Courageous"], ["Bold"]]).unlocked).toBe(false);
  });

  it("unlocks at exactly the threshold and reports the observer count", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(MIN_OBSERVERS).toBe(3);
    expect(agg.observerCount).toBe(3);
    expect(agg.unlocked).toBe(true);
  });

  it("exposes each observer's own normalized scores in input order for anonymous drill-down", () => {
    const responses = [["Courageous"], wordsForTribe("levi")];
    const agg: ObserverAggregate = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(["Courageous"]));
    expect(agg.perObserver[1]).toEqual(score(wordsForTribe("levi")));
  });

  it("treats each observer's selection as a set (dedup/unknown handled by the scoring core)", () => {
    const withDupesAndJunk = aggregateObservers([
      ["Courageous", "Courageous", "notaword"],
    ]);
    const clean = aggregateObservers([["Courageous"]]);
    expect(withDupesAndJunk.average).toEqual(clean.average);
  });
});
