import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, OBSERVER_UNLOCK_THRESHOLD } from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("averages each observer's normalized scores with equal weight", () => {
    const obs1 = ["Courageous"]; // judah-only single word
    const obs2 = wordsForTribe("levi"); // full levi coverage
    const agg = aggregateObservers([obs1, obs2]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, score(obs1)) +
          scoreFor(tribe.slug, score(obs2))) /
        2;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected);
    }
  });

  it("gives word count no influence — a many-word observer does not dominate", () => {
    // One observer floods Levi (full coverage → 1.0); two others each pick a
    // single Judah word. Equal weight caps the flooder's Levi at its 1-of-3
    // share, while the two single-word observers still carry real weight.
    const flood = wordsForTribe("levi");
    const single = ["Courageous"]; // judah-only
    const agg = aggregateObservers([flood, single, single]);

    // Levi reaches only its one-observer share (1/3), not a majority.
    expect(scoreFor("levi", agg.average)).toBeCloseTo(1 / 3);

    // Pooling all words and scoring once would instead let the flooder dominate:
    // Levi's pooled, normalized score is strictly higher than its equal-weight
    // average. This is the skew equal-weight averaging exists to prevent.
    const pooled = score([...flood, ...single, ...single]);
    expect(scoreFor("levi", pooled)).toBeGreaterThan(
      scoreFor("levi", agg.average),
    );

    // The two single-word observers give Judah genuine representation.
    expect(scoreFor("judah", agg.average)).toBeGreaterThan(0);
  });

  it("is unchanged by adding identical observers (pure equal-weight mean)", () => {
    const words = wordsForTribe("issachar");
    const one = score(words);
    const agg = aggregateObservers([words, words, words]);

    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(
        scoreFor(tribe.slug, one),
      );
    }
  });

  it("exposes each observer's own scores for the anonymous drill-down, in order", () => {
    const obs1 = ["Courageous"];
    const obs2 = wordsForTribe("levi");
    const agg = aggregateObservers([obs1, obs2]);

    expect(agg.perObserver).toHaveLength(2);
    expect(scoreFor("judah", agg.perObserver[0])).toBeCloseTo(
      scoreFor("judah", score(obs1)),
    );
    expect(scoreFor("levi", agg.perObserver[1])).toBeCloseTo(1);
  });

  it("locks below the threshold and unlocks at it", () => {
    const resp = wordsForTribe("judah");
    expect(aggregateObservers([]).unlocked).toBe(false);
    expect(aggregateObservers([resp]).unlocked).toBe(false);
    expect(aggregateObservers([resp, resp]).unlocked).toBe(false);

    const three = aggregateObservers([resp, resp, resp]);
    expect(three.unlocked).toBe(true);
    expect(three.observerCount).toBe(3);

    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });

  it("returns an all-zero twelve-tribe profile for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("keeps the average in canonical order and within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      wordsForTribe("issachar"),
    ]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});
