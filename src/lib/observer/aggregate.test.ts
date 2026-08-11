import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns all-zero average and zero count for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });

  it("returns a single observer's own normalized scores as the average", () => {
    const words = wordsForTribe("judah");
    const agg = aggregateObservers([{ words }]);

    expect(agg.observerCount).toBe(1);
    expect(agg.perObserver).toHaveLength(1);
    // With one observer the average is just that observer's normalized scores.
    expect(agg.average).toEqual(score(words));
    expect(agg.perObserver[0]).toEqual(score(words));
  });

  it("averages equally so word count never becomes influence", () => {
    // One observer picks many Judah words, another picks a single Levi word.
    // Each observer is normalized independently, then averaged with equal weight,
    // so the second observer is not drowned out by the first's larger selection.
    const heavyJudah = wordsForTribe("judah");
    const oneLevi = wordsForTribe("levi").slice(0, 1);

    const agg = aggregateObservers([{ words: heavyJudah }, { words: oneLevi }]);

    const a = score(heavyJudah);
    const b = score(oneLevi);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected, 10);
    }
  });

  it("gives each observer equal weight regardless of order", () => {
    const w1 = wordsForTribe("judah");
    const w2 = wordsForTribe("levi");
    const w3 = wordsForTribe("dan");

    const forward = aggregateObservers([
      { words: w1 },
      { words: w2 },
      { words: w3 },
    ]);
    const reversed = aggregateObservers([
      { words: w3 },
      { words: w2 },
      { words: w1 },
    ]);

    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, forward.average)).toBeCloseTo(
        scoreFor(tribe.slug, reversed.average),
        10,
      );
    }
  });

  it("keeps the average within 0–1 in canonical tribe order", () => {
    const agg = aggregateObservers([
      { words: wordsForTribe("judah") },
      { words: wordsForTribe("levi") },
      { words: wordsForTribe("issachar") },
    ]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe with a self-minus-others delta", () => {
    const self = score(wordsForTribe("judah"));
    const others = aggregateObservers([
      { words: wordsForTribe("levi") },
    ]).average;

    const rows = compareProfiles(self, others);
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));

    for (const row of rows) {
      expect(row.self).toBe(scoreFor(row.slug, self));
      expect(row.others).toBe(scoreFor(row.slug, others));
      expect(row.delta).toBeCloseTo(row.self - row.others, 10);
    }
  });

  it("reports a positive delta where the Subject rates higher than others", () => {
    const self = score(wordsForTribe("judah"));
    const others = aggregateObservers([
      { words: wordsForTribe("levi") },
    ]).average;

    const rows = compareProfiles(self, others);
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.delta).toBeGreaterThan(0);
  });
});

describe("OBSERVER_UNLOCK_THRESHOLD", () => {
  it("unlocks the comparison report at three observers (ADR-0003)", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });
});
