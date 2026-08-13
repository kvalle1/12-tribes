import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
  scoreObserver,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug, for building targeted selections. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([{ words: ["Courageous"] }]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero when there are no responses", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the single observer's own profile unchanged for one response", () => {
    const words = wordsForTribe("judah").slice(0, 3);
    const others = aggregateObservers([{ words }]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("is the equal-weight average of each observer's normalized profile", () => {
    const a = wordsForTribe("judah").slice(0, 3);
    const b = wordsForTribe("levi").slice(0, 3);
    const others = aggregateObservers([{ words: a }, { words: b }]);

    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // One observer picks a broad selection, the other a narrow one. Equal-weight
    // aggregation must still count each as exactly one profile in the mean — the
    // 15-word observer does not outweigh the 8-word observer.
    const broad = WORDS.slice(0, 15).map((w) => w.word);
    const narrow = WORDS.slice(0, 8).map((w) => w.word);

    const others = aggregateObservers([{ words: broad }, { words: narrow }]);
    const expected = score(broad).map((s, i) => ({
      slug: s.slug,
      avg: (s.score + score(narrow)[i].score) / 2,
    }));

    for (const { slug, avg } of expected) {
      expect(scoreFor(slug, others)).toBeCloseTo(avg);
    }
  });

  it("is not the score of a pooled bag of everyone's words", () => {
    // Two observers who each concentrate on a different tribe. Pooling all their
    // words and scoring once dilutes each tribe differently than averaging the
    // two normalized profiles does; the aggregate must follow the average, not
    // the pool, so a prolific observer can't dominate the shared "others" view.
    const a = wordsForTribe("judah").slice(0, 4);
    const b = wordsForTribe("dan").slice(0, 4);

    const aggregate = aggregateObservers([{ words: a }, { words: b }]);
    const pooled = score([...a, ...b]);

    const differs = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, aggregate) - scoreFor(t.slug, pooled)) > 1e-9,
    );
    expect(differs).toBe(true);
  });

  it("exposes the per-observer profile via scoreObserver for anonymous drill-down", () => {
    const words = wordsForTribe("judah").slice(0, 3);
    expect(scoreObserver({ words })).toEqual(score(words));
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    for (let n = 0; n < MIN_OBSERVERS_FOR_REPORT; n++) {
      expect(isReportUnlocked(n)).toBe(false);
    }
  });

  it("unlocks at exactly the minimum and above", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 5)).toBe(true);
  });
});
