import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankScores } from "./ranking";

/** Build a score table for ranking tests, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankScores", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankScores(tableFrom({ judah: 0.4 }));
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.slug)).size).toBe(12);
  });

  it("orders tribes by score descending", () => {
    const ranked = rankScores(
      tableFrom({ judah: 0.2, levi: 0.5, dan: 0.35 }),
    );
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked[0].slug).toBe("levi");
    expect(ranked.map((r) => r.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("keeps the normalized score as the bar value", () => {
    const ranked = rankScores(tableFrom({ levi: 0.5, dan: 0.25 }));
    expect(ranked[0].score).toBe(0.5);
    expect(ranked.find((r) => r.slug === "dan")!.score).toBe(0.25);
    expect(ranked[ranked.length - 1].score).toBe(0);
  });

  it("keeps canonical (tribe number) order for an all-zero selection", () => {
    const ranked = rankScores(tableFrom({}));
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});
