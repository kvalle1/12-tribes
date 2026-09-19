import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  observersRemaining,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("averages each observer's normalized profile with equal weight", () => {
    // Two observers who each fully cover a different tribe. Levi has 6 words,
    // Issachar 10 — the second observer selects more words. Equal-weight
    // aggregation must still give them the same influence: each tribe in the
    // "others" profile is the arithmetic mean of the two per-observer scores.
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");
    const agg = aggregateObservers([{ words: a }, { words: b }]);

    const profileA = score(a);
    const profileB = score(b);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(
        (scoreFor(tribe.slug, profileA) + scoreFor(tribe.slug, profileB)) / 2,
      );
    }

    // Full coverage each ⇒ each halved to 0.5 in the equal-weight average.
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
  });

  it("is not a pooled bag of words (word count does not buy influence)", () => {
    // If we pooled every observer's words and scored once, full coverage of both
    // tribes would read 1.0 each. Equal-weight aggregation reads 0.5 each — the
    // 10-word observer does not dominate the 6-word one.
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");

    const pooled = score([...a, ...b]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);

    const agg = aggregateObservers([{ words: a }, { words: b }]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
  });

  it("gives a few-word observer the same weight as a many-word observer", () => {
    // Observer A picks a small selection; Observer B fully covers a larger tribe.
    // Each contributes exactly half of its own normalized profile, so A's signal
    // is halved the same as B's — not drowned out by B's larger word count.
    const a = wordsForTribe("judah").slice(0, 2);
    const b = wordsForTribe("issachar");
    const agg = aggregateObservers([{ words: a }, { words: b }]);

    expect(scoreFor("judah", agg.others)).toBeCloseTo(
      scoreFor("judah", score(a)) / 2,
    );
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
  });

  it("returns one normalized profile per observer for anonymous drill-down", () => {
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");
    const c = wordsForTribe("judah");
    const agg = aggregateObservers([{ words: a }, { words: b }, { words: c }]);

    expect(agg.count).toBe(3);
    expect(agg.perObserver).toHaveLength(3);
    // Each entry is exactly that observer's own normalized score.
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    expect(agg.perObserver[2]).toEqual(score(c));
  });

  it("returns a zero profile for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.count).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("produces others scores in canonical tribe order", () => {
    const agg = aggregateObservers([{ words: wordsForTribe("levi") }]);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer as a set (dedupes, ignores unknown words)", () => {
    // A single observer scored with duplicates and junk equals scoring the
    // clean set — the equal-weight average of one observer is that profile.
    const agg = aggregateObservers([
      { words: ["Courageous", "Courageous", "notaword"] },
    ]);
    const clean = score(["Courageous"]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });
});

describe("report unlock threshold", () => {
  it("unlocks only at or above the threshold", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });

  it("counts down how many more observers are needed", () => {
    expect(observersRemaining(0)).toBe(3);
    expect(observersRemaining(2)).toBe(1);
    expect(observersRemaining(3)).toBe(0);
    expect(observersRemaining(4)).toBe(0);
  });
});
