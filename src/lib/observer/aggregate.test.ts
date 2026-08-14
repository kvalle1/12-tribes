import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** A word that maps to exactly one tribe (the given slug), if one exists. */
const soloWordFor = (slug: string) =>
  WORDS.find((w) => w.tribes.length === 1 && w.tribes[0] === slug)?.word;

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

const mean = (nums: number[]) =>
  nums.reduce((a, b) => a + b, 0) / nums.length;

describe("aggregateObservers", () => {
  it("returns a profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("dan") },
    ]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.observerCount).toBe(3);
  });

  it("is the equal-weight average of each observer's normalized profile", () => {
    // The core contract (ADR-0003): score each observer individually, then take
    // the mean per tribe — not a pooled bag of words.
    const responses = [
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("asher") },
    ];
    const individual = responses.map((r) => score(r.words));
    const agg = aggregateObservers(responses);

    for (const tribe of tribes) {
      const expected = mean(individual.map((obs) => scoreFor(tribe.slug, obs)));
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(expected);
    }
  });

  it("a single observer's aggregate equals that observer's own profile", () => {
    const words = wordsForTribe("zebulun");
    const agg = aggregateObservers([{ words }]);
    const own = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(
        scoreFor(tribe.slug, own),
      );
    }
  });

  it("weights every observer equally regardless of how many words they picked", () => {
    // One observer names a single word for a tribe; another floods the same
    // tribe with all of its words. Equal weighting means each still counts 1/2,
    // so the tribe's aggregate is the mean of their two normalized scores — the
    // wordy observer does NOT dominate.
    const solo = soloWordFor("gad");
    // Guard: the assertion only makes sense if a solo (single-tribe) word exists.
    expect(solo).toBeDefined();

    const sparse = { words: [solo!] };
    const flood = { words: wordsForTribe("gad") };

    const agg = aggregateObservers([sparse, flood]);
    const expected = mean([
      scoreFor("gad", score(sparse.words)),
      scoreFor("gad", score(flood.words)),
    ]);
    expect(scoreFor("gad", agg.scores)).toBeCloseTo(expected);
  });

  it("differs from a pooled bag of words (equal-weight, not concatenated)", () => {
    // A wordy observer and a terse one. Pooling all their words into one score
    // lets the wordy one dominate; equal-weight averaging does not. The two must
    // therefore disagree for at least one tribe.
    const wordy = { words: wordsForTribe("judah") };
    const terse = { words: [soloWordFor("reuben") ?? wordsForTribe("reuben")[0]] };

    const agg = aggregateObservers([wordy, terse]);
    const pooled = score([...wordy.words, ...terse.words]);

    const differs = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, agg.scores) - scoreFor(t.slug, pooled)) >
        1e-9,
    );
    expect(differs).toBe(true);
  });

  it("preserves each observer's individual normalized profile for drill-down", () => {
    const responses = [
      { words: wordsForTribe("naphtali") },
      { words: wordsForTribe("benjamin") },
    ];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(2);
    responses.forEach((r, i) => {
      expect(agg.perObserver[i]).toEqual(score(r.words));
    });
  });

  it("returns an all-zero profile and no observers for an empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });
});
