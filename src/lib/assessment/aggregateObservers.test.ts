import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  type ObserverAggregate,
} from "./aggregateObservers";

/** All words that map to a given tribe slug (mirrors score.test's helper). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

const avgFor = (slug: string, agg: ObserverAggregate) =>
  scoreFor(slug, agg.average);

describe("aggregateObservers", () => {
  it("returns a full 12-tribe average in canonical (tribe number) order", () => {
    const agg = aggregateObservers([
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("dan") },
    ]);

    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("averages per-observer normalized scores with equal weight — not a pooled bag of words", () => {
    // Observer A selects every word for a tribe → their normalized score for it
    // is 1.0. Observer B selects a single word for the same tribe → a small
    // normalized score. Because B's words are a subset of A's, pooling the two
    // and scoring once yields A's score unchanged (1.0). Equal-weight averaging
    // must instead land on the mean of the two individual scores.
    const slug = "asher";
    const allWords = wordsForTribe(slug);
    expect(allWords.length).toBeGreaterThan(1);

    const aWords = allWords;
    const bWords = [allWords[0]];

    const agg = aggregateObservers([{ words: aWords }, { words: bWords }]);

    const aScore = scoreFor(slug, score(aWords));
    const bScore = scoreFor(slug, score(bWords));
    const pooledScore = scoreFor(slug, score([...aWords, ...bWords]));

    // Equal-weight average is the mean of the individual normalized scores…
    expect(avgFor(slug, agg)).toBeCloseTo((aScore + bScore) / 2, 10);
    // …and is demonstrably NOT the pooled-bag score.
    expect(avgFor(slug, agg)).not.toBeCloseTo(pooledScore, 5);
  });

  it("gives every observer equal influence regardless of how many words they picked", () => {
    // One observer picking many words must not outweigh one picking few.
    const heavy = { words: wordsForTribe("judah") };
    const light = { words: [wordsForTribe("dan")[0]] };

    const forward = aggregateObservers([heavy, light]);
    const reversed = aggregateObservers([light, heavy]);

    // Order-independent, and each contributes exactly half of the average.
    for (const t of tribes) {
      expect(avgFor(t.slug, forward)).toBeCloseTo(avgFor(t.slug, reversed), 10);
    }
    const judahMean =
      (scoreFor("judah", score(heavy.words)) +
        scoreFor("judah", score(light.words))) /
      2;
    expect(avgFor("judah", forward)).toBeCloseTo(judahMean, 10);
  });

  it("exposes an anonymous per-observer breakdown, one entry per response in order", () => {
    const responses = [
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("dan") },
    ];
    const agg = aggregateObservers(responses);

    expect(agg.perObserver).toHaveLength(3);
    // Each entry is a full canonical 12-tribe score set and carries no identity.
    for (const observer of agg.perObserver) {
      expect(observer.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
      for (const entry of observer) {
        expect(Object.keys(entry).sort()).toEqual(["name", "score", "slug"]);
      }
    }
    // The first observer's breakdown matches scoring their words directly.
    expect(agg.perObserver[0]).toEqual(score(responses[0].words));
  });

  it("locks until at least MIN_OBSERVERS responses exist", () => {
    const one = aggregateObservers([{ words: wordsForTribe("judah") }]);
    expect(one.observerCount).toBe(1);
    expect(one.unlocked).toBe(false);

    const two = aggregateObservers([
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
    ]);
    expect(two.unlocked).toBe(false);

    const three = aggregateObservers([
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("dan") },
    ]);
    expect(three.observerCount).toBe(MIN_OBSERVERS);
    expect(three.unlocked).toBe(true);
  });

  it("handles zero observers without dividing by zero", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average).toHaveLength(tribes.length);
    for (const entry of agg.average) expect(entry.score).toBe(0);
  });

  it("ignores unknown words and duplicates within an observer's selection", () => {
    const base = wordsForTribe("judah");
    const noisy = aggregateObservers([
      { words: [...base, ...base, "not-a-real-word"] },
    ]);
    const clean = aggregateObservers([{ words: base }]);
    for (const t of tribes) {
      expect(avgFor(t.slug, noisy)).toBeCloseTo(avgFor(t.slug, clean), 10);
    }
  });
});
