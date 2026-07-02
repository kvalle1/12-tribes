import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns the equal-weight average of per-observer normalized scores", () => {
    const a = wordsForTribe("levi");
    const b = wordsForTribe("judah");
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(expected);
    }
  });

  it("is an average of normalized profiles, not a pooled bag of words", () => {
    // Observer A picks all of Levi's words (Levi = 1.0 for A); observer B picks a
    // single Judah word (Levi = 0 for B). Equal-weight averaging puts Levi at
    // 0.5. Pooling A+B into one word bag would leave Levi at a full 1.0 — a
    // wordier observer would then dominate. This is the ADR-0003 distinction.
    const agg = aggregateObservers([wordsForTribe("levi"), ["Courageous"]]);
    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5);

    const pooled = score([...wordsForTribe("levi"), "Courageous"]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
  });

  it("gives every observer equal influence regardless of word count", () => {
    // A picks many words, B picks few. Each still contributes exactly half of the
    // average for any tribe — influence is per-observer, never per-word.
    const many = wordsForTribe("levi");
    const few = ["Courageous"];
    const agg = aggregateObservers([many, few]);
    const sMany = score(many);
    const sFew = score(few);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(
        (scoreFor(tribe.slug, sMany) + scoreFor(tribe.slug, sFew)) / 2,
      );
    }
  });

  it("with a single observer returns that observer's own normalized profile", () => {
    const words = wordsForTribe("levi");
    const agg = aggregateObservers([words]);
    const s = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(
        scoreFor(tribe.slug, s),
      );
    }
    expect(agg.observerCount).toBe(1);
  });

  it("handles no observers: zeroed profile, count 0, no per-observer entries", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });

  it("exposes each observer's individual profile for anonymous drill-down", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("judah"),
    ]);
    expect(agg.perObserver).toHaveLength(2);
    expect(scoreFor("levi", agg.perObserver[0])).toBeCloseTo(1);
    expect(scoreFor("judah", agg.perObserver[1])).toBeCloseTo(1);
    // Per-observer profiles carry no identity — just the scored tribes.
    expect(Object.keys(agg.perObserver[0][0]).sort()).toEqual([
      "name",
      "score",
      "slug",
    ]);
  });

  it("returns all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("isReportUnlocked / MIN_OBSERVERS", () => {
  it("unlocks only at 3 or more observer responses (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(7)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("pairs self and others scores per tribe with a self-minus-others delta", () => {
    const self = score(wordsForTribe("levi"));
    const others = aggregateObservers([wordsForTribe("judah")]).average;
    const rows = compareProfiles(self, others);

    expect(rows).toHaveLength(12);
    const levi = rows.find((r) => r.slug === "levi")!;
    // Self reads high on Levi, others read zero → positive divergence.
    expect(levi.self).toBeCloseTo(1);
    expect(levi.others).toBeCloseTo(0);
    expect(levi.delta).toBeCloseTo(1);

    const judah = rows.find((r) => r.slug === "judah")!;
    // Others read Judah, self reads zero → negative divergence.
    expect(judah.delta).toBeCloseTo(-judah.others);
  });

  it("ranks by the stronger of the two profiles so the headline tribes lead", () => {
    const self = score(wordsForTribe("levi"));
    const others = aggregateObservers([wordsForTribe("judah")]).average;
    const rows = compareProfiles(self, others);
    const strengths = rows.map((r) => Math.max(r.self, r.others));
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeLessThanOrEqual(strengths[i - 1] + 1e-9);
    }
  });
});
