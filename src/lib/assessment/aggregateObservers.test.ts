import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns the equal-weight average of each observer's normalized scores", () => {
    // Observer A fully covers levi (levi=1.0, everything else 0); Observer B
    // fully covers issachar. The equal-weight average gives each tribe half.
    const agg = aggregateObservers([wordsForTribe("levi"), wordsForTribe("issachar")]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
  });

  it("is an average of normalized profiles, NOT a pooled bag of words", () => {
    // levi has 6 words, issachar 10. Pooling every word and scoring once would
    // give each tribe a full 1.0 (full coverage). Averaging two individually-
    // normalized observers instead gives 0.5 — the equal-weight contract.
    const levi = wordsForTribe("levi");
    const issachar = wordsForTribe("issachar");

    const pooled = score([...levi, ...issachar]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1.0);

    const agg = aggregateObservers([levi, issachar]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.others)).not.toBeCloseTo(scoreFor("levi", pooled));
  });

  it("gives an observer who picks more words no more influence", () => {
    // Issachar's observer selects 10 words, levi's only 6, yet each fully covers
    // one tribe — and both tribes land equal in the aggregate. Word count does
    // not translate into weight.
    const levi = wordsForTribe("levi");
    const issachar = wordsForTribe("issachar");
    expect(issachar.length).toBeGreaterThan(levi.length);

    const agg = aggregateObservers([levi, issachar]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(scoreFor("issachar", agg.others));
  });

  it("a repeated observer profile pulls the average toward it (equal per-response weight)", () => {
    // Two levi observers and one issachar observer → levi weighted 2/3.
    const levi = wordsForTribe("levi");
    const issachar = wordsForTribe("issachar");
    const agg = aggregateObservers([levi, levi, issachar]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(2 / 3);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(1 / 3);
  });

  it("scores each observer individually for anonymous drill-down, in input order", () => {
    const agg = aggregateObservers([wordsForTribe("levi"), wordsForTribe("issachar")]);
    expect(agg.observers).toHaveLength(2);
    expect(agg.observers.map((o) => o.index)).toEqual([1, 2]);
    expect(scoreFor("levi", agg.observers[0].scores)).toBeCloseTo(1);
    expect(scoreFor("issachar", agg.observers[1].scores)).toBeCloseTo(1);
  });

  it("carries no observer identity — only an anonymous index and scores", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(Object.keys(agg.observers[0]).sort()).toEqual(["index", "scores"]);
  });

  it("reports the observer count", () => {
    expect(aggregateObservers([]).count).toBe(0);
    expect(
      aggregateObservers([wordsForTribe("levi"), wordsForTribe("issachar")]).count,
    ).toBe(2);
  });

  it("returns all 12 tribes in canonical order, each 0–1", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("averages to an all-zero others profile for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.observers).toEqual([]);
  });

  it("mirrors the single observer's own profile when only one responded", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(1);
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below three observers", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(1)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
  });

  it("unlocks at three or more observers", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(4)).toBe(true);
  });

  it("keeps the unlock threshold at three (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
