import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";
import { buildComparisonReport } from "./report";

const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

const A = tribes[0].slug;
const B = tribes[1].slug;
const selfWords = wordsForTribe(A).slice(0, 8);
const observer = () => wordsForTribe(B).slice(0, 6);

describe("buildComparisonReport — locked state (< 3 Observers)", () => {
  it("is locked with zero Observers", () => {
    const r = buildComparisonReport(selfWords, []);
    expect(r.unlocked).toBe(false);
    expect(r.observerCount).toBe(0);
    expect(r.remaining).toBe(3);
  });

  it("stays locked at two Observers and reports one remaining", () => {
    const r = buildComparisonReport(selfWords, [observer(), observer()]);
    expect(r.unlocked).toBe(false);
    expect(r.observerCount).toBe(2);
    expect(r.remaining).toBe(1);
  });

  it("exposes no Observer data while locked (anonymity below threshold)", () => {
    const r = buildComparisonReport(selfWords, [observer(), observer()]);
    expect(r.observers).toHaveLength(0);
    expect(r.comparison).toHaveLength(0);
    expect(r.others.every((t) => t.score === 0)).toBe(true);
  });

  it("still carries the Subject's own profile while locked", () => {
    const r = buildComparisonReport(selfWords, [observer()]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, r.self)).toBeCloseTo(
        scoreFor(t.slug, score(selfWords)),
      );
    }
  });
});

describe("buildComparisonReport — unlocked state (≥ 3 Observers)", () => {
  const lists = [observer(), observer(), observer()];
  const r = buildComparisonReport(selfWords, lists);

  it("unlocks at exactly three Observers with none remaining", () => {
    expect(r.unlocked).toBe(true);
    expect(r.observerCount).toBe(3);
    expect(r.remaining).toBe(0);
  });

  it("uses the equal-weight aggregate for the others profile", () => {
    const expected = aggregateObservers(lists);
    for (const t of tribes) {
      expect(scoreFor(t.slug, r.others)).toBeCloseTo(
        scoreFor(t.slug, expected),
      );
    }
  });

  it("provides an anonymous, sequentially-labelled per-Observer drill-down", () => {
    expect(r.observers).toHaveLength(3);
    expect(r.observers.map((o) => o.index)).toEqual([1, 2, 3]);
    // Drill-down carries only an index and scores — no identity fields.
    for (const o of r.observers) {
      expect(Object.keys(o).sort()).toEqual(["index", "scores"]);
    }
  });

  it("reports self, others, and the gap for every tribe", () => {
    expect(r.comparison).toHaveLength(12);
    for (const row of r.comparison) {
      expect(row.gap).toBeCloseTo(row.selfScore - row.othersScore);
    }
  });

  it("sorts the comparison strongest-first by the higher of self/others", () => {
    const strength = r.comparison.map((c) =>
      Math.max(c.selfScore, c.othersScore),
    );
    const sorted = [...strength].sort((a, b) => b - a);
    expect(strength).toEqual(sorted);
  });
});
