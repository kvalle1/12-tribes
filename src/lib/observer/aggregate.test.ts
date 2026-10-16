import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  type ObserverAggregation,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Elementwise mean of several score tables, keyed by slug. */
const meanOf = (tables: TribeScore[][]): Record<string, number> => {
  const sum: Record<string, number> = {};
  for (const t of tables)
    for (const s of t) sum[s.slug] = (sum[s.slug] ?? 0) + s.score;
  const mean: Record<string, number> = {};
  for (const slug of Object.keys(sum)) mean[slug] = sum[slug] / tables.length;
  return mean;
};

describe("aggregateObservers", () => {
  it("returns all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("averages each observer's normalized scores with equal weight", () => {
    const responses = [
      wordsForTribe("levi"),
      ["Courageous"],
      ["Bold", "Zealous"],
    ];
    const agg = aggregateObservers(responses);
    const expected = meanOf(responses.map((r) => score(r)));
    for (const row of agg.others) {
      expect(row.score).toBeCloseTo(expected[row.slug]);
    }
  });

  it("weights observers equally regardless of how many words each picks", () => {
    // Observer A picks a single word; Observer B picks a whole tribe's worth.
    // Equal-weight averaging normalizes *first*, so B's larger word count does
    // not buy it more influence — each contributes exactly half the average.
    const few = ["Courageous"]; // 1 word
    const many = wordsForTribe("issachar"); // 10 words
    const agg = aggregateObservers([few, many]);
    const expected = meanOf([score(few), score(many)]);
    for (const row of agg.others) {
      expect(row.score).toBeCloseTo(expected[row.slug]);
    }
    // Sanity: the mean sits halfway, not pulled toward the wordier observer.
    const soloJudah = scoreFor("judah", score(few));
    expect(scoreFor("judah", agg.others)).toBeCloseTo(soloJudah / 2);
  });

  it("averages the per-observer profiles, not a pooled bag of words", () => {
    // Pooling would let an observer who selected many judah words dominate a
    // single levi-only observer. Equal-weight averaging gives each observer's
    // normalized profile the same pull. Full levi coverage (score 1.0) averaged
    // against a near-zero levi observer must land at ~0.5 — the mean — never the
    // pooled count.
    const observerFullLevi = wordsForTribe("levi"); // levi normalized = 1.0
    const observerNoLevi = ["Courageous"]; // judah-only, levi = 0
    const agg = aggregateObservers([observerFullLevi, observerNoLevi]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
  });

  it("keeps averaged scores within the normalized 0–1 range", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("judah"),
      wordsForTribe("issachar"),
    ]);
    for (const row of agg.others) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(1);
    }
  });

  it("locks the comparison below the minimum observer count", () => {
    for (let n = 0; n < MIN_OBSERVERS; n++) {
      const responses = Array.from({ length: n }, () => ["Courageous"]);
      const agg = aggregateObservers(responses);
      expect(agg.observerCount).toBe(n);
      expect(agg.unlocked).toBe(false);
    }
  });

  it("unlocks once at least MIN_OBSERVERS observers have responded", () => {
    const responses = Array.from({ length: MIN_OBSERVERS }, () => [
      "Courageous",
    ]);
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(MIN_OBSERVERS);
    expect(agg.unlocked).toBe(true);
  });

  it("handles zero observers without dividing by zero", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("exposes each observer's own scores in response order for anonymous drill-down", () => {
    const responses = [wordsForTribe("levi"), ["Courageous"], ["Bold"]];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(3);
    // Order is preserved so the report can label them Observer 1 / 2 / 3.
    expect(agg.perObserver[0]).toEqual(score(responses[0]));
    expect(agg.perObserver[1]).toEqual(score(responses[1]));
    expect(agg.perObserver[2]).toEqual(score(responses[2]));
    // Nothing in the per-observer data identifies who an observer is — it is
    // only tribe scores.
    for (const table of agg.perObserver) {
      expect(table.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("inherits the scoring core's set semantics (dupes/unknowns ignored)", () => {
    const clean = aggregateObservers([["Courageous"]]);
    const noisy = aggregateObservers([["Courageous", "Courageous", "notaword"]]);
    for (const slug of tribes.map((t) => t.slug)) {
      expect(scoreFor(slug, noisy.others)).toBeCloseTo(
        scoreFor(slug, clean.others),
      );
    }
  });
});

// Keeps the exported shape honest for consumers (the report page).
const _typecheck: ObserverAggregation = aggregateObservers([]);
void _typecheck;
