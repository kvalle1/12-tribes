import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns the equal-weight average of each observer's normalized scores", () => {
    // Three arbitrary, distinct responses.
    const responses = [
      wordsForTribe(tribes[0].slug),
      wordsForTribe(tribes[3].slug),
      [...wordsForTribe(tribes[6].slug), ...wordsForTribe(tribes[7].slug)],
    ];

    const { others } = aggregateObservers(responses);

    // The "others" profile is exactly the per-tribe arithmetic mean of the
    // individually-normalized observer scores — the equal-weight contract.
    for (const tribe of tribes) {
      const mean =
        responses.reduce((sum, w) => sum + scoreFor(tribe.slug, score(w)), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean, 10);
    }
  });

  it("weights each observer equally, not by how many words they picked (no pooled bag)", () => {
    // Two observers pointing at two disjoint tribes. A pooled bag of words would
    // report each tribe at its full solo strength (a single combined voter);
    // equal-weight averaging halves each, because only one of the two observers
    // saw that tribe. This is what stops a verbose observer from dominating.
    const aSlug = tribes[0].slug;
    const aWords = wordsForTribe(aSlug);
    const bSlug = tribes[1].slug;
    const bWords = wordsForTribe(bSlug).filter((w) => !aWords.includes(w));

    const soloA = scoreFor(aSlug, score(aWords));
    const soloB = scoreFor(bSlug, score(bWords));
    expect(soloA).toBeGreaterThan(0);
    expect(soloB).toBeGreaterThan(0);

    const { others } = aggregateObservers([aWords, bWords]);

    // Equal-weight: each disjoint tribe lands at half its solo strength...
    expect(scoreFor(aSlug, others)).toBeCloseTo(soloA / 2, 10);
    expect(scoreFor(bSlug, others)).toBeCloseTo(soloB / 2, 10);
    // ...not at the pooled-bag value (the full solo strength).
    expect(scoreFor(aSlug, others)).not.toBeCloseTo(soloA, 6);
  });

  it("returns per-observer normalized profiles for anonymous drill-down", () => {
    const responses = [
      wordsForTribe(tribes[2].slug),
      wordsForTribe(tribes[5].slug),
      wordsForTribe(tribes[9].slug),
    ];

    const { perObserver } = aggregateObservers(responses);

    expect(perObserver).toHaveLength(3);
    // Anonymous 1-based labels, in submission order, no other attributes.
    expect(perObserver.map((o) => o.index)).toEqual([1, 2, 3]);
    for (const [i, obs] of perObserver.entries()) {
      expect(Object.keys(obs).sort()).toEqual(["index", "scores"]);
      // Each observer carries a full, canonically-ordered 12-tribe profile.
      expect(obs.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
      expect(obs.scores).toEqual(score(responses[i]));
    }
  });

  it("stays locked below the unlock threshold and unlocks at it", () => {
    const one = [wordsForTribe(tribes[0].slug)];
    const two = [wordsForTribe(tribes[0].slug), wordsForTribe(tribes[1].slug)];
    const three = [
      wordsForTribe(tribes[0].slug),
      wordsForTribe(tribes[1].slug),
      wordsForTribe(tribes[2].slug),
    ];

    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(aggregateObservers(one).unlocked).toBe(false);
    expect(aggregateObservers(two).unlocked).toBe(false);
    expect(aggregateObservers(three).unlocked).toBe(true);
    expect(aggregateObservers(three).observerCount).toBe(3);
  });

  it("handles no responses as an empty, locked, all-zero profile", () => {
    const agg = aggregateObservers([]);

    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });
});
