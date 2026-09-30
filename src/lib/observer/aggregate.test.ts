import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
  hasEnoughObservers,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("reports how many observers were aggregated", () => {
    const agg = aggregateObservers([
      ["Courageous"],
      ["Bold"],
      ["Zealous"],
    ]);
    expect(agg.count).toBe(3);
    expect(agg.observers).toHaveLength(3);
  });

  it("returns an all-zero average for no observers (never divides by zero)", () => {
    const agg = aggregateObservers([]);
    expect(agg.count).toBe(0);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the average in canonical (tribe number) order for all 12 tribes", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer individually with the shared scoring core", () => {
    const agg = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    // Observer 1 fully covers levi → levi normalizes to 1.0 for them alone.
    expect(scoreFor("levi", agg.observers[0].scores)).toBeCloseTo(1);
    // Observer 2's scores match scoring their words in isolation.
    expect(agg.observers[1].scores).toEqual(score(["Courageous"]));
  });

  it("is the equal-weight average of per-observer normalized scores", () => {
    const responses = [wordsForTribe("levi"), ["Courageous"], ["Zealous"]];
    const individual = responses.map((r) => score(r));
    const agg = aggregateObservers(responses);
    for (const tribe of tribes) {
      const expected =
        individual.reduce((sum, s) => sum + scoreFor(tribe.slug, s), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected);
    }
  });

  it("does not pool words — an observer who picks more words gains no extra influence", () => {
    // Observer A fully describes with every levi word; Observer B picks a single
    // judah word. Equal-weight averaging gives each observer one vote, so levi's
    // "others" score is (1.0 + 0) / 2 = 0.5 — NOT the ~1.0 a pooled bag of words
    // (A's many words swamping B's one) would produce.
    const observerA = wordsForTribe("levi");
    const observerB = ["Courageous"]; // a single judah word
    const agg = aggregateObservers([observerA, observerB]);
    const pooled = score([...observerA, ...observerB]);

    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    // The two aggregation strategies genuinely differ for uneven word counts.
    expect(scoreFor("levi", agg.average)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );
  });

  it("weights every observer equally regardless of how many words they select", () => {
    // Halving one observer's word count must not change the equal-weight average
    // beyond that observer's own (still equally-weighted) contribution.
    const many = wordsForTribe("levi");
    const few = many.slice(0, Math.max(1, Math.floor(many.length / 2)));
    const withMany = aggregateObservers([many, ["Courageous"]]);
    const withFew = aggregateObservers([few, ["Courageous"]]);
    // The second observer (judah) contributes 1/2 in both, unaffected by how many
    // words the first observer chose.
    expect(scoreFor("judah", withMany.average)).toBeCloseTo(
      scoreFor("judah", withFew.average),
    );
  });

  it("labels observers anonymously as 1..n in input order, carrying no identity", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg.observers.map((o) => o.index)).toEqual([1, 2, 3]);
    // Each observer profile exposes only an index and scores — nothing else.
    for (const observer of agg.observers) {
      expect(Object.keys(observer).sort()).toEqual(["index", "scores"]);
    }
  });

  it("does not mutate the input responses", () => {
    const responses = [["Courageous"], ["Bold"]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at or above the threshold of 3", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
