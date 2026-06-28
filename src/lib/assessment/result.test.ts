import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankTribeScores, resolveHeadline } from "./result";

/** Build a score table for ranking tests, defaulting unmentioned tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankTribeScores", () => {
  it("returns all 12 tribes ordered by score, highest first", () => {
    const ranked = rankTribeScores(tableFrom({ judah: 0.4, levi: 0.9, dan: 0.6 }));
    expect(ranked).toHaveLength(12);
    expect(ranked.slice(0, 3).map((r) => r.slug)).toEqual(["levi", "dan", "judah"]);
    // Scores are monotonically non-increasing down the ranking.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("assigns 1-based ranks in descending score order", () => {
    const ranked = rankTribeScores(tableFrom({ judah: 0.4, levi: 0.9 }));
    expect(ranked[0]).toMatchObject({ slug: "levi", rank: 1 });
    expect(ranked[1]).toMatchObject({ slug: "judah", rank: 2 });
    expect(ranked.map((r) => r.rank)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("scales bar fill to the top score so the leader fills the bar", () => {
    const ranked = rankTribeScores(tableFrom({ judah: 1.0, levi: 0.5, dan: 0.25 }));
    const fill = (slug: string) => ranked.find((r) => r.slug === slug)!.fillPct;
    expect(fill("judah")).toBeCloseTo(100);
    expect(fill("levi")).toBeCloseTo(50);
    expect(fill("dan")).toBeCloseTo(25);
  });

  it("gives every tribe a 0% bar when nothing scored (no divide-by-zero)", () => {
    const ranked = rankTribeScores(tableFrom({}));
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.fillPct === 0)).toBe(true);
  });

  it("breaks ties by canonical tribe order without mutating the input", () => {
    const input = tableFrom({ judah: 0.8, benjamin: 0.8 });
    const ranked = rankTribeScores(input);
    // judah (#1) precedes benjamin (#6) on an equal score.
    const judahIdx = ranked.findIndex((r) => r.slug === "judah");
    const benjaminIdx = ranked.findIndex((r) => r.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
    // Input array is untouched (pure function).
    expect(input.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("resolveHeadline", () => {
  it("resolves the primary slug to its full tribe", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.name).toBe("Judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a secondary when present", () => {
    const { secondary } = resolveHeadline("judah", "levi");
    expect(secondary?.name).toBe("Levi");
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nope")).toThrow();
  });
});
