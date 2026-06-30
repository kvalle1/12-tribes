import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankScores } from "./ranking";

/** Build a TribeScore table for all 12 tribes, defaulting unmentioned ones to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankScores", () => {
  it("returns every tribe exactly once", () => {
    const ranked = rankScores(tableFrom({ judah: 0.4, levi: 0.2 }));
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.slug)).size).toBe(12);
  });

  it("orders by score descending with 1-based ranks", () => {
    const ranked = rankScores(tableFrom({ judah: 0.2, levi: 0.9, reuben: 0.5 }));
    expect(ranked.map((r) => r.slug).slice(0, 3)).toEqual([
      "levi",
      "reuben",
      "judah",
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("breaks ties by canonical tribe order (stable sort)", () => {
    // judah (#1) and benjamin (#6) tie; judah keeps the earlier canonical slot.
    const ranked = rankScores(tableFrom({ judah: 0.5, benjamin: 0.5 }));
    const judahPos = ranked.findIndex((r) => r.slug === "judah");
    const benjaminPos = ranked.findIndex((r) => r.slug === "benjamin");
    expect(judahPos).toBeLessThan(benjaminPos);
  });

  it("gives the leader a full bar and scales the rest proportionally", () => {
    const ranked = rankScores(tableFrom({ judah: 0.4, levi: 0.2, reuben: 0.1 }));
    const bar = (slug: string) => ranked.find((r) => r.slug === slug)!.barPercent;
    expect(bar("judah")).toBeCloseTo(100);
    expect(bar("levi")).toBeCloseTo(50);
    expect(bar("reuben")).toBeCloseTo(25);
  });

  it("scores of zero get a zero-width bar", () => {
    const ranked = rankScores(tableFrom({ judah: 0.4 }));
    const zeros = ranked.filter((r) => r.score === 0);
    expect(zeros.length).toBe(11);
    expect(zeros.every((r) => r.barPercent === 0)).toBe(true);
  });

  it("handles an all-zero table without dividing by zero", () => {
    const ranked = rankScores(tableFrom({}));
    expect(ranked.every((r) => r.barPercent === 0)).toBe(true);
    expect(ranked.every((r) => Number.isFinite(r.barPercent))).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = tableFrom({ levi: 0.9, judah: 0.2 });
    const before = input.map((s) => s.slug);
    rankScores(input);
    expect(input.map((s) => s.slug)).toEqual(before);
  });
});
