import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, table: TribeScore[]) =>
  table.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** A word that does not map to `slug` — used to give a tribe a clean zero. */
const wordAvoiding = (slug: string) =>
  WORDS.find((w) => !w.tribes.includes(slug))!.word;

describe("aggregateObservers", () => {
  it("returns a profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([{ words: ["Courageous"] }]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("counts the observers that went into the average", () => {
    const agg = aggregateObservers([
      { words: ["Courageous"] },
      { words: ["Bold"] },
    ]);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
  });

  it("scores all-zero with no observers and never divides by zero", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the equal-weight average of each observer's normalized score", () => {
    const responses = [
      { words: wordsForTribe("levi") }, // full levi coverage
      { words: ["Courageous"] }, // judah-only word
    ];
    const agg = aggregateObservers(responses);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, score(responses[0].words)) +
          scoreFor(tribe.slug, score(responses[1].words))) /
        2;
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal influence regardless of word count", () => {
    // Observer A floods judah with all of its words; Observer B picks a single
    // word that avoids judah. Under equal-weight averaging (not word pooling),
    // judah's aggregate is exactly half A's judah score — A's larger word count
    // buys no extra influence.
    const responses = [
      { words: wordsForTribe("judah") },
      { words: [wordAvoiding("judah")] },
    ];
    const agg = aggregateObservers(responses);
    const judahSolo = scoreFor("judah", score(wordsForTribe("judah")));
    expect(scoreFor("judah", agg.scores)).toBeCloseTo(judahSolo / 2);
  });

  it("exposes each observer's own profile for anonymous drill-down", () => {
    const responses = [
      { words: ["Courageous"] },
      { words: wordsForTribe("levi") },
    ];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver[0]).toEqual(score(responses[0].words));
    expect(agg.perObserver[1]).toEqual(score(responses[1].words));
  });
});

describe("isComparisonUnlocked", () => {
  it(`stays locked below ${MIN_OBSERVERS} observers and unlocks at ${MIN_OBSERVERS}`, () => {
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe in canonical order with others − self delta", () => {
    const self = score(wordsForTribe("judah"));
    const others = score(wordsForTribe("levi"));
    const rows = compareProfiles(self, others);

    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    for (const row of rows) {
      expect(row.delta).toBeCloseTo(row.others - row.self);
    }
    // Others read levi; self read judah — so levi diverges positive, judah negative.
    expect(rows.find((r) => r.slug === "levi")!.delta).toBeGreaterThan(0);
    expect(rows.find((r) => r.slug === "judah")!.delta).toBeLessThan(0);
  });
});
