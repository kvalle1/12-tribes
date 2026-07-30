import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareSelfToOthers,
  summarizeComparison,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("aggregateObservers", () => {
  it("returns the equal-weight average of each observer's normalized scores, in canonical order", () => {
    const responses = [
      ["Courageous", "Loyal", "Strategic"],
      ["Merciful", "Devoted", "Grounded"],
      ["Fierce", "Prophetic", "Discerning"],
    ];

    const { others } = aggregateObservers(responses);

    // The "others" profile is the element-wise mean of the per-observer
    // normalized score() outputs — nothing else.
    const perObserver = responses.map((r) => score(r));
    const expected = tribes.map((tribe, i) => {
      const sum = perObserver.reduce((acc, s) => acc + s[i].score, 0);
      return sum / responses.length;
    });

    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
    others.forEach((o, i) => expect(o.score).toBeCloseTo(expected[i], 12));
  });

  it("counts each observer equally regardless of how many words they picked (not a pooled bag of words)", () => {
    // Pick two tribes that share no words so each observer's selection is
    // isolated to their own tribe.
    const a = tribes[0].slug;
    const b = tribes.find(
      (t) =>
        t.slug !== a &&
        !wordsForTribe(t.slug).some((w) => wordsForTribe(a).includes(w)),
    )!.slug;

    const manyWords = wordsForTribe(a); // a large selection, fully covering tribe A
    const fewWords = wordsForTribe(b).slice(0, 2); // a deliberately tiny selection

    expect(manyWords.length).toBeGreaterThan(fewWords.length);

    const { others } = aggregateObservers([manyWords, fewWords]);

    // Each observer contributes their own normalized score at weight 1/2. The
    // observer with far more words does not dominate: A's "others" value is
    // exactly half of that observer's (normalized) A score, same rule as B.
    const soloA = scoreFor(a, score(manyWords));
    const soloB = scoreFor(b, score(fewWords));
    expect(scoreFor(a, others)).toBeCloseTo(soloA / 2, 12);
    expect(scoreFor(b, others)).toBeCloseTo(soloB / 2, 12);

    // And it is NOT the pooled result: scoring the concatenated bag of words
    // would let the word-heavy observer skew the profile.
    const pooled = score([...manyWords, ...fewWords]);
    expect(scoreFor(a, others)).not.toBeCloseTo(scoreFor(a, pooled), 6);
  });

  it("exposes each observer's own normalized scores for anonymous drill-down, order-stable", () => {
    const responses = [
      wordsForTribe(tribes[0].slug),
      wordsForTribe(tribes[1].slug),
      wordsForTribe(tribes[2].slug),
    ];
    const { perObserver, observerCount } = aggregateObservers(responses);

    expect(observerCount).toBe(3);
    expect(perObserver).toHaveLength(3);
    // Order matches the input order, so "Observer 1/2/3" labels are stable.
    perObserver.forEach((s, i) => {
      expect(s).toEqual(score(responses[i]));
    });
  });

  it("handles no responses: zero count and an all-zero others profile", () => {
    const { others, perObserver, observerCount } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.every((o) => o.score === 0)).toBe(true);
  });

  it("does not mutate the input responses", () => {
    const responses = [["Courageous", "Loyal"]];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it("unlocks only at three or more observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});

describe("compareSelfToOthers", () => {
  it("pairs self and others per tribe with signed divergence (others − self), in canonical order", () => {
    const self = tableFrom({ [tribes[0].slug]: 0.8, [tribes[1].slug]: 0.2 });
    const others = tableFrom({ [tribes[0].slug]: 0.5, [tribes[1].slug]: 0.6 });

    const rows = compareSelfToOthers(self, others);

    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    const first = rows.find((r) => r.slug === tribes[0].slug)!;
    expect(first.self).toBeCloseTo(0.8, 12);
    expect(first.others).toBeCloseTo(0.5, 12);
    expect(first.divergence).toBeCloseTo(-0.3, 12); // others see it less
    const second = rows.find((r) => r.slug === tribes[1].slug)!;
    expect(second.divergence).toBeCloseTo(0.4, 12); // others see it more
  });
});

describe("summarizeComparison", () => {
  it("names each side's top tribe, whether they align, and the largest divergence", () => {
    const rows = compareSelfToOthers(
      tableFrom({ [tribes[0].slug]: 0.9, [tribes[1].slug]: 0.3 }),
      tableFrom({ [tribes[0].slug]: 0.4, [tribes[2].slug]: 0.7 }),
    );

    const summary = summarizeComparison(rows);
    expect(summary.topSelf.slug).toBe(tribes[0].slug);
    expect(summary.topOthers.slug).toBe(tribes[2].slug);
    expect(summary.aligned).toBe(false);
    // tribes[2]: others 0.7 vs self 0 → +0.7 is the largest gap.
    expect(summary.largestDivergence.slug).toBe(tribes[2].slug);
    expect(summary.largestDivergence.divergence).toBeCloseTo(0.7, 12);
  });

  it("reports alignment when both sides lead with the same tribe", () => {
    const rows = compareSelfToOthers(
      tableFrom({ [tribes[0].slug]: 0.9, [tribes[1].slug]: 0.3 }),
      tableFrom({ [tribes[0].slug]: 0.8, [tribes[1].slug]: 0.5 }),
    );
    const summary = summarizeComparison(rows);
    expect(summary.aligned).toBe(true);
    expect(summary.topSelf.slug).toBe(summary.topOthers.slug);
  });
});
