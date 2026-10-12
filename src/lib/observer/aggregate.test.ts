import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a 12-tribe others profile in canonical order", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
    ]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns each observer's individually-normalized profile (anonymous, ordered)", () => {
    const selections = [wordsForTribe("judah"), wordsForTribe("levi")];
    const agg = aggregateObservers(selections);
    expect(agg.perObserver).toHaveLength(2);
    // Each per-observer profile is exactly that observer's own score().
    expect(agg.perObserver[0]).toEqual(score(selections[0]));
    expect(agg.perObserver[1]).toEqual(score(selections[1]));
  });

  it("is the equal-weight average of per-observer normalized scores, not a pooled bag of words", () => {
    const selections = [wordsForTribe("judah"), wordsForTribe("levi")];
    const agg = aggregateObservers(selections);
    const [a, b] = agg.perObserver;
    // Definition of equal-weight: every tribe is the mean of the per-observer
    // scores. This is what rules out pooling the words first.
    for (const tribe of tribes) {
      const mean =
        (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(mean);
    }
  });

  it("gives an observer who selects more words no more influence than one who selects fewer", () => {
    // Observer 1 picks every word for judah (a large selection); Observer 2 picks
    // a single word for levi. If influence were pooled by word count, judah would
    // swamp levi. Under equal weight each observer contributes exactly one share.
    const manyWordsForJudah = wordsForTribe("judah");
    expect(manyWordsForJudah.length).toBeGreaterThan(1);
    const oneLeviWord = [wordsForTribe("levi")[0]];

    const agg = aggregateObservers([manyWordsForJudah, oneLeviWord]);

    const judahOthers = scoreFor("judah", agg.others);
    const leviOthers = scoreFor("levi", agg.others);

    // Each contributes exactly half of its own normalized top score.
    expect(judahOthers).toBeCloseTo(scoreFor("judah", score(manyWordsForJudah)) / 2);
    expect(leviOthers).toBeCloseTo(scoreFor("levi", score(oneLeviWord)) / 2);

    // Swapping which observer has more words must not change the others profile —
    // order and word count carry no weight.
    const swapped = aggregateObservers([oneLeviWord, manyWordsForJudah]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, swapped.others)).toBeCloseTo(
        scoreFor(tribe.slug, agg.others),
      );
    }
  });

  it("unlocks only once at least the threshold number of observers have responded", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);

    const one = aggregateObservers([wordsForTribe("judah")]);
    expect(one.observerCount).toBe(1);
    expect(one.unlocked).toBe(false);

    const two = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
    ]);
    expect(two.observerCount).toBe(2);
    expect(two.unlocked).toBe(false);

    const three = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("dan"),
    ]);
    expect(three.observerCount).toBe(3);
    expect(three.unlocked).toBe(true);
  });

  it("handles no observers with an all-zero, locked profile", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });
});
