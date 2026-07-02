import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregateObservers";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("judah")]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is the equal-weight average of each observer's normalized profile", () => {
    const respA = wordsForTribe("judah");
    const respB = wordsForTribe("levi");

    const agg = aggregateObservers([respA, respB]);

    const sA = score(respA);
    const sB = score(respB);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sA) + scoreFor(tribe.slug, sB)) / 2;
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(expected, 10);
    }
  });

  it("gives an observer who picks more words no extra influence (not a pooled bag of words)", () => {
    // One observer picks many words across many tribes; the other picks few.
    // Equal-weight averaging must not let the wordy observer dominate the way a
    // pooled `score(allWords)` would.
    const wordy = [
      ...wordsForTribe("judah"),
      ...wordsForTribe("levi"),
      ...wordsForTribe("dan"),
    ];
    const sparse = wordsForTribe("benjamin");

    const agg = aggregateObservers([wordy, sparse]);

    // Aggregate matches the average of the two individual normalized profiles…
    const sWordy = score(wordy);
    const sSparse = score(sparse);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sWordy) + scoreFor(tribe.slug, sSparse)) / 2;
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(expected, 10);
    }

    // …and is genuinely different from pooling every word into one score.
    const pooled = score([...wordy, ...sparse]);
    const differs = tribes.some(
      (t) =>
        Math.abs(
          scoreFor(t.slug, agg.scores) - scoreFor(t.slug, pooled),
        ) > 1e-6,
    );
    expect(differs).toBe(true);
  });

  it("exposes each observer's individual normalized profile in order for anonymous drill-down", () => {
    const respA = wordsForTribe("judah");
    const respB = wordsForTribe("levi");
    const respC = wordsForTribe("dan");

    const agg = aggregateObservers([respA, respB, respC]);

    expect(agg.perObserver).toHaveLength(3);
    expect(agg.perObserver[0]).toEqual(score(respA));
    expect(agg.perObserver[1]).toEqual(score(respB));
    expect(agg.perObserver[2]).toEqual(score(respC));
  });

  it("counts observers and stays locked below the unlock threshold", () => {
    const one = aggregateObservers([wordsForTribe("judah")]);
    expect(one.observerCount).toBe(1);
    expect(one.unlocked).toBe(false);

    const two = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
    ]);
    expect(two.observerCount).toBe(2);
    expect(two.unlocked).toBe(false);
  });

  it("unlocks once at least the threshold number of observers respond", () => {
    const responses = Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }, () =>
      wordsForTribe("judah"),
    );
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(OBSERVER_UNLOCK_THRESHOLD);
    expect(agg.unlocked).toBe(true);
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });

  it("handles no responses: all-zero, zero count, locked", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });
});
