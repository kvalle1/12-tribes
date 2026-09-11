import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  scoreEachObserver,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is all-zero with no Observer responses", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single Observer's normalized score when there is one Observer", () => {
    const words = wordsForTribe("levi");
    const others = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("is the equal-weight mean of each Observer's normalized scores (not a pooled bag of words)", () => {
    // Derive the expectation from the real scoring core so this survives any
    // future normalization/threshold tuning.
    const a = ["Courageous", "Bold"];
    const b = wordsForTribe("issachar");
    const c = ["Zealous"];
    const tables = [score(a), score(b), score(c)];

    const others = aggregateObservers([a, b, c]);
    for (const tribe of tribes) {
      const mean =
        tables.reduce((sum, t) => sum + scoreFor(tribe.slug, t), 0) /
        tables.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean);
    }
  });

  it("averages equal-weight rather than pooling — a tribe only one Observer fully covers lands at 1/N, not 1.0", () => {
    // Observer A fully covers Levi, Observer B fully covers Issachar. Pooling
    // both bags would score each tribe ~1.0; equal-weight averaging over the two
    // Observers halves each to ~0.5.
    const observerA = wordsForTribe("levi");
    const observerB = wordsForTribe("issachar");

    const others = aggregateObservers([observerA, observerB]);
    const pooled = score([...observerA, ...observerB]);

    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
    // Averaged is strictly below pooled where a single Observer carries a tribe.
    expect(scoreFor("levi", others)).toBeLessThan(scoreFor("levi", pooled));
  });

  it("gives a wordier Observer no extra influence (more words ≠ more weight)", () => {
    // Issachar has more words than Levi, so Observer A picks strictly more words
    // than Observer B — yet each fully covers their own tribe and lands at the
    // same 1/N share. Word count buys no pull.
    const observerA = wordsForTribe("issachar"); // the wordy one
    const observerB = wordsForTribe("levi"); // the sparse one
    expect(observerA.length).toBeGreaterThan(observerB.length);

    const others = aggregateObservers([observerA, observerB]);
    expect(scoreFor("issachar", others)).toBeCloseTo(scoreFor("levi", others));
  });

  it("keeps every aggregated score within the normalized 0–1 range", () => {
    const others = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      ["Bold", "Zealous", "Courageous"],
    ]);
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("scoreEachObserver", () => {
  it("returns one normalized 12-tribe table per Observer, in order", () => {
    const lists = [wordsForTribe("levi"), ["Courageous"]];
    const perObserver = scoreEachObserver(lists);
    expect(perObserver).toHaveLength(2);
    for (const table of perObserver) {
      expect(table.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Each table matches scoring that Observer's words directly.
    expect(perObserver[0]).toEqual(score(lists[0]));
    expect(perObserver[1]).toEqual(score(lists[1]));
  });
});

describe("compareProfiles", () => {
  it("lines up self and others per tribe with divergence = self − others", () => {
    const self = score(wordsForTribe("judah"));
    const others = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("levi"),
      wordsForTribe("levi"),
    ]);
    const comparison = compareProfiles(self, others);

    expect(comparison.map((c) => c.slug)).toEqual(tribes.map((t) => t.slug));
    for (const c of comparison) {
      expect(c.divergence).toBeCloseTo(c.self - c.others);
    }
    // The Subject reads Judah in themselves; the observers read Levi. The gap
    // shows up with the expected signs.
    const judah = comparison.find((c) => c.slug === "judah")!;
    const levi = comparison.find((c) => c.slug === "levi")!;
    expect(judah.divergence).toBeGreaterThan(0); // self sees Judah more
    expect(levi.divergence).toBeLessThan(0); // others see Levi more
  });
});

describe("isReportUnlocked", () => {
  it("unlocks only at or above the minimum Observer count", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
