import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  compareSelfToOthers,
  isComparisonUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero others profile and no observers for an empty set", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the others profile in canonical (tribe number) order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("for a single observer, the others profile equals that observer's own score", () => {
    const words = wordsForTribe("judah").slice(0, 2);
    const agg = aggregateObservers([words]);
    const own = score(words);
    expect(agg.others.map((s) => s.score)).toEqual(own.map((s) => s.score));
    expect(agg.observerCount).toBe(1);
  });

  it("averages each observer's normalized score with equal weight", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("dan");
    const agg = aggregateObservers([a, b]);

    const sa = score(a);
    const sb = score(b);
    for (const slug of tribes.map((t) => t.slug)) {
      const expected = (scoreFor(slug, sa) + scoreFor(slug, sb)) / 2;
      expect(scoreFor(slug, agg.others)).toBeCloseTo(expected);
    }
  });

  it("does not let an observer who picks more words gain more influence (equal weight, not pooled)", () => {
    // Observer A picks every Judah word; Observer B picks a single Judah word.
    const many = wordsForTribe("judah");
    const few = [wordsForTribe("judah")[0]];
    const agg = aggregateObservers([many, few]);

    // Equal-weight average of the two individually-normalized Judah scores.
    const meanOfIndividuals =
      (scoreFor("judah", score(many)) + scoreFor("judah", score(few))) / 2;
    expect(scoreFor("judah", agg.others)).toBeCloseTo(meanOfIndividuals);

    // A pooled bag of words would score Judah differently (the many-word
    // observer would dominate), so the aggregate must NOT equal the pooled score.
    const pooled = scoreFor("judah", score([...many, ...few]));
    expect(scoreFor("judah", agg.others)).not.toBeCloseTo(pooled);
  });

  it("exposes each observer's individual normalized profile in input order", () => {
    const a = wordsForTribe("judah").slice(0, 2);
    const b = wordsForTribe("dan").slice(0, 2);
    const agg = aggregateObservers([a, b]);

    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0].map((s) => s.score)).toEqual(
      score(a).map((s) => s.score),
    );
    expect(agg.perObserver[1].map((s) => s.score)).toEqual(
      score(b).map((s) => s.score),
    );
  });
});

describe("isComparisonUnlocked", () => {
  it("is locked below the minimum observer threshold", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(1)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
  });

  it("unlocks at and above the minimum observer threshold", () => {
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(4)).toBe(true);
  });
});

describe("compareSelfToOthers", () => {
  it("pairs self and others scores per tribe in canonical order with the signed gap", () => {
    const self = score(wordsForTribe("judah"));
    const { others } = aggregateObservers([wordsForTribe("dan")]);

    const { rows } = compareSelfToOthers(self, others);
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    for (const row of rows) {
      expect(row.gap).toBeCloseTo(row.self - row.others);
    }
  });

  it("sorts divergences by the magnitude of the gap, largest first", () => {
    const self = score(wordsForTribe("judah"));
    const { others } = aggregateObservers([wordsForTribe("dan")]);

    const { divergences } = compareSelfToOthers(self, others);
    for (let i = 1; i < divergences.length; i++) {
      expect(Math.abs(divergences[i - 1].gap)).toBeGreaterThanOrEqual(
        Math.abs(divergences[i].gap),
      );
    }
    // Judah should be the sharpest divergence: self chose Judah words, others
    // chose Dan words, so self sees far more Judah than others do.
    expect(divergences[0].slug).toBe("judah");
    expect(divergences[0].gap).toBeGreaterThan(0);
  });
});
