import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug — enough to vary observer counts. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns one canonical-order score row per tribe", () => {
    const agg = aggregateObservers([["Courageous"], ["Wise"], ["Faithful"]]);
    expect(agg.others).toHaveLength(tribes.length);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("counts the observers it aggregated", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([["Courageous"], ["Wise"]]).observerCount,
    ).toBe(2);
  });

  it("averages each observer's individually-normalized scores (equal weight)", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("issachar");
    const expected = tribes.map((tribe) => {
      const sa = scoreFor(tribe.slug, score(a));
      const sb = scoreFor(tribe.slug, score(b));
      return (sa + sb) / 2;
    });
    const agg = aggregateObservers([a, b]);
    for (let i = 0; i < tribes.length; i++) {
      expect(agg.others[i].score).toBeCloseTo(expected[i], 10);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // A heavy observer (many words) and a light observer (few words). Pooling
    // their words into one score would let the heavy one dominate; equal-weight
    // averaging must not.
    const heavy = wordsForTribe("judah"); // many words
    const light = wordsForTribe("issachar").slice(0, 1); // a single word

    const equalWeight = aggregateObservers([heavy, light]).others;
    const pooled = score([...heavy, ...light]);

    const expected = tribes.map((tribe) => {
      const sh = scoreFor(tribe.slug, score(heavy));
      const sl = scoreFor(tribe.slug, score(light));
      return (sh + sl) / 2;
    });

    // Matches the equal-weight average…
    for (let i = 0; i < tribes.length; i++) {
      expect(equalWeight[i].score).toBeCloseTo(expected[i], 10);
    }
    // …and is demonstrably NOT the pooled "bag of words" score.
    const differs = tribes.some(
      (tribe) =>
        Math.abs(
          scoreFor(tribe.slug, equalWeight) - scoreFor(tribe.slug, pooled),
        ) > 1e-9,
    );
    expect(differs).toBe(true);
  });

  it("exposes each observer's own normalized scores for anonymous drill-down", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("issachar");
    const agg = aggregateObservers([a, b]);

    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    // Canonical order preserved per observer.
    for (const observer of agg.perObserver) {
      expect(observer.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("is all-zero and locked with no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.unlocked).toBe(false);
  });

  it(`stays locked below ${OBSERVER_UNLOCK_THRESHOLD} observers and unlocks at it`, () => {
    const one = ["Courageous"];
    expect(aggregateObservers([one]).unlocked).toBe(false);
    expect(aggregateObservers([one, one]).unlocked).toBe(false);
    expect(aggregateObservers([one, one, one]).unlocked).toBe(true);
    expect(aggregateObservers([one, one, one, one]).unlocked).toBe(true);
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });

  it("ignores unknown words the same way the scoring core does", () => {
    const agg = aggregateObservers([["Courageous", "definitely-not-a-word"]]);
    expect(agg.others).toEqual(
      aggregateObservers([["Courageous"]]).others,
    );
  });
});
