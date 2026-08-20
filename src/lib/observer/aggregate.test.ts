import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** Words that map to `slug`. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Words that map to `slug` and to no other tribe `avoid`. */
const wordsForTribeOnlyAvoiding = (slug: string, avoid: string) =>
  WORDS.filter(
    (w) => w.tribes.includes(slug) && !w.tribes.includes(avoid),
  ).map((w) => w.word);

const slugA = tribes[0].slug;
const slugB = tribes[1].slug;

describe("aggregateObservers", () => {
  it("returns the equal-weight average of per-observer normalized scores", () => {
    const obsA = wordsForTribe(slugA).slice(0, 10);
    const obsB = wordsForTribe(slugB).slice(0, 8);
    const responses = [{ words: obsA }, { words: obsB }];

    const { others } = aggregateObservers(responses);

    // For every tribe, `others` is exactly the mean of each observer's own
    // normalized score for that tribe — the definition of equal weight.
    const profileA = score(obsA);
    const profileB = score(obsB);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, profileA) + scoreFor(tribe.slug, profileB)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected, 12);
    }
  });

  it("is an equal-weight average, not a pooled bag of words", () => {
    // Observer A picks many words for tribe A; Observer B picks words for tribe
    // B that never touch tribe A. Pooling all words scores tribe A off A's
    // earnings alone; the equal-weight average halves A's influence because B
    // contributes a zero for A. So the average must be strictly below pooled.
    const obsA = wordsForTribe(slugA).slice(0, 12);
    const obsB = wordsForTribeOnlyAvoiding(slugB, slugA).slice(0, 8);
    expect(obsA.length).toBeGreaterThan(0);
    expect(obsB.length).toBeGreaterThan(0);

    const { others } = aggregateObservers([{ words: obsA }, { words: obsB }]);
    const pooled = score([...obsA, ...obsB]);

    const averageA = scoreFor(slugA, others);
    const pooledA = scoreFor(slugA, pooled);

    expect(pooledA).toBeGreaterThan(0);
    expect(averageA).toBeCloseTo(pooledA / 2, 12);
    expect(averageA).toBeLessThan(pooledA);
  });

  it("gives a wordy observer no more influence than a terse one", () => {
    // Same tribe emphasis, very different word counts: each observer's profile
    // still counts once, so neither dominates the average.
    const wordy = wordsForTribe(slugA).slice(0, 15);
    const terse = wordsForTribe(slugB).slice(0, 8);
    const { others } = aggregateObservers([{ words: wordy }, { words: terse }]);

    const expectedA = scoreFor(slugA, score(wordy)) / 2;
    const expectedB = scoreFor(slugB, score(terse)) / 2;
    expect(scoreFor(slugA, others)).toBeCloseTo(expectedA, 12);
    expect(scoreFor(slugB, others)).toBeCloseTo(expectedB, 12);
  });

  it("returns a full 12-tribe profile in canonical order", () => {
    const { others } = aggregateObservers([
      { words: wordsForTribe(slugA).slice(0, 8) },
    ]);
    expect(others).toHaveLength(12);
    expect(others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("exposes each observer's own profile in response order, anonymously", () => {
    const obsA = wordsForTribe(slugA).slice(0, 9);
    const obsB = wordsForTribe(slugB).slice(0, 8);
    const { perObserver } = aggregateObservers([
      { words: obsA },
      { words: obsB },
    ]);

    expect(perObserver).toHaveLength(2);
    // Each drill-down profile is a full canonical 12-tribe score and matches the
    // scoring core — and carries nothing but slug/name/score (no identity).
    expect(perObserver[0]).toEqual(score(obsA));
    expect(perObserver[1]).toEqual(score(obsB));
    for (const profile of perObserver) {
      for (const entry of profile) {
        expect(Object.keys(entry).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });

  it("locks below the threshold and unlocks at it", () => {
    const one = [{ words: wordsForTribe(slugA).slice(0, 8) }];
    const two = [...one, { words: wordsForTribe(slugB).slice(0, 8) }];
    const three = [...two, { words: wordsForTribe(slugA).slice(0, 9) }];

    expect(aggregateObservers([]).unlocked).toBe(false);
    expect(aggregateObservers(one).unlocked).toBe(false);
    expect(aggregateObservers(two).unlocked).toBe(false);
    expect(aggregateObservers(three).unlocked).toBe(true);

    expect(aggregateObservers(three).observerCount).toBe(3);
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });

  it("returns an all-zero locked profile for no observers", () => {
    const result = aggregateObservers([]);
    expect(result.observerCount).toBe(0);
    expect(result.unlocked).toBe(false);
    expect(result.perObserver).toEqual([]);
    expect(result.others).toHaveLength(12);
    expect(result.others.every((t) => t.score === 0)).toBe(true);
  });
});
