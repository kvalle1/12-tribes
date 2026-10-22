import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";

/** The i-th-tribe score from a canonical-order score vector, by slug. */
const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

const ALL_WORDS = WORDS.map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for every tribe in canonical order", () => {
    const agg = aggregateObservers([ALL_WORDS.slice(0, 8)]);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.scores.map((s) => s.name)).toEqual(tribes.map((t) => t.name));
  });

  it("reports the number of observer responses it aggregated", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([ALL_WORDS.slice(0, 8), ALL_WORDS.slice(8, 16)])
        .observerCount,
    ).toBe(2);
  });

  it("scores all-zero with no observers and exposes no per-observer rows", () => {
    const agg = aggregateObservers([]);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });

  it("equals the single observer's own normalized score when there is one", () => {
    const words = ALL_WORDS.slice(0, 10);
    const agg = aggregateObservers([words]);
    expect(agg.scores).toEqual(score(words));
    expect(agg.perObserver).toEqual([score(words)]);
  });

  it("averages each observer's normalized score with equal weight", () => {
    const a = ALL_WORDS.slice(0, 8);
    const b = ALL_WORDS.slice(8, 20);
    const agg = aggregateObservers([a, b]);

    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2,
        10,
      );
    }
  });

  it("gives an observer who picks more words no extra influence (not a pooled bag of words)", () => {
    // `small` picks the fewest allowed words; `big` picks a disjoint, much larger
    // set. Equal-weight averaging must count each observer once, so the aggregate
    // is the mean of their individually-normalized profiles — NOT the score of all
    // their words pooled together, where `big`'s larger pile would dominate.
    const small = ALL_WORDS.slice(0, 8);
    const big = ALL_WORDS.slice(8, 23);
    const agg = aggregateObservers([small, big]);

    const equalWeight = tribes.map(
      (t) =>
        (scoreFor(t.slug, score(small)) + scoreFor(t.slug, score(big))) / 2,
    );
    const pooled = score([...small, ...big]);

    // Matches the equal-weight mean everywhere…
    tribes.forEach((t, i) => {
      expect(scoreFor(t.slug, agg.scores)).toBeCloseTo(equalWeight[i], 10);
    });
    // …and differs from the pooled-bag-of-words profile for at least one tribe.
    const differsFromPooled = tribes.some(
      (t, i) => Math.abs(scoreFor(t.slug, pooled) - equalWeight[i]) > 1e-9,
    );
    expect(differsFromPooled).toBe(true);
  });

  it("is unaffected by an observer repeating the same word (dedupe before scoring)", () => {
    const words = ALL_WORDS.slice(0, 8);
    const withDupes = [...words, ...words.slice(0, 3)];
    expect(aggregateObservers([withDupes]).scores).toEqual(
      aggregateObservers([words]).scores,
    );
  });

  it("keeps each observer's own normalized profile in input order for drill-down", () => {
    const a = ALL_WORDS.slice(0, 8);
    const b = ALL_WORDS.slice(8, 18);
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    // Each per-observer vector is itself in canonical tribe order.
    for (const observer of agg.perObserver) {
      expect(observer.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });
});
