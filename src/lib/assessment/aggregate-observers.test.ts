import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  canUnlockReport,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate-observers";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero profile for every tribe when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("returns exactly that observer's normalized profile for a single observer", () => {
    const words = wordsForTribe("levi");
    const agg = aggregateObservers([words]);
    expect(agg.observerCount).toBe(1);
    // Equal to scoring that one observer directly — nothing is diluted.
    expect(agg.scores.map((s) => s.score)).toEqual(
      score(words).map((s) => s.score),
    );
  });

  it("is the equal-weight average of each observer's individually-normalized scores", () => {
    const a = wordsForTribe("levi"); // maxes out levi for observer A
    const b = wordsForTribe("issachar"); // maxes out issachar for observer B
    const agg = aggregateObservers([a, b]);

    const sa = score(a);
    const sb = score(b);
    // Definitional: each tribe is the mean of the two observers' own scores.
    for (let i = 0; i < agg.scores.length; i++) {
      expect(agg.scores[i].score).toBeCloseTo((sa[i].score + sb[i].score) / 2);
    }
    // Two observers who each fully cover a different tribe → each lands at ~0.5.
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.scores)).toBeCloseTo(0.5);
  });

  it("does not pool words — a prolific observer gains no extra influence", () => {
    // Observer A picks a broad, word-heavy selection; Observer B picks a lean
    // selection concentrated on one tribe. Under equal-weight averaging, B's one
    // tribe still counts as a full half of the "others" view. Under pooling,
    // A's larger word count would dominate and B's tribe would be diluted.
    const heavy = wordsForTribe("issachar"); // 10 words, spread by sharing
    const lean = wordsForTribe("levi"); // 6 words, concentrated on levi

    const agg = aggregateObservers([heavy, lean]);

    // Equal-weight: levi is B's champion at 1.0, averaged with A's ~0 → ~0.5.
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(
      (scoreFor("levi", score(heavy)) + 1) / 2,
    );

    // Contrast with pooling all words into one score() call: pooling would NOT
    // equal the equal-weight average, proving we did not pool.
    const pooled = score([...heavy, ...lean]);
    expect(scoreFor("levi", agg.scores)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );
  });

  it("exposes each observer's profile in input order for anonymous drill-down", () => {
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0].map((s) => s.score)).toEqual(
      score(a).map((s) => s.score),
    );
    expect(agg.perObserver[1].map((s) => s.score)).toEqual(
      score(b).map((s) => s.score),
    );
  });

  it("keeps all 12 tribes in canonical order and within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("dan"),
    ]);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("canUnlockReport", () => {
  it("stays locked below the minimum observer count", () => {
    expect(canUnlockReport(0)).toBe(false);
    expect(canUnlockReport(MIN_OBSERVERS_TO_UNLOCK - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(canUnlockReport(MIN_OBSERVERS_TO_UNLOCK)).toBe(true);
    expect(canUnlockReport(MIN_OBSERVERS_TO_UNLOCK + 5)).toBe(true);
  });
});
