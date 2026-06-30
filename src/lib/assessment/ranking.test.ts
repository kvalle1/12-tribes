import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankTribeScores, rankWords } from "./ranking";

/** Build a score table for ranking tests, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankTribeScores", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankTribeScores(tableFrom({ judah: 0.8 }));
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.tribe.slug)).size).toBe(12);
  });

  it("orders tribes by score, highest first", () => {
    const ranked = rankTribeScores(
      tableFrom({ judah: 0.4, reuben: 0.9, levi: 0.6 }),
    );
    expect(ranked.slice(0, 3).map((r) => r.tribe.slug)).toEqual([
      "reuben",
      "levi",
      "judah",
    ]);
    // Scores are monotonically non-increasing down the list.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }
  });

  it("gives the leader a full-width bar and scales the rest proportionally", () => {
    const ranked = rankTribeScores(tableFrom({ judah: 1.0, reuben: 0.5 }));
    expect(ranked[0].fraction).toBeCloseTo(1);
    const reuben = ranked.find((r) => r.tribe.slug === "reuben")!;
    expect(reuben.fraction).toBeCloseTo(0.5);
  });

  it("scales the bar relative to the leader, not to an absolute 1.0", () => {
    // Leader well below 1.0 still fills its bar; a tribe at half its score is half.
    const ranked = rankTribeScores(tableFrom({ judah: 0.3, reuben: 0.15 }));
    expect(ranked[0].fraction).toBeCloseTo(1);
    const reuben = ranked.find((r) => r.tribe.slug === "reuben")!;
    expect(reuben.fraction).toBeCloseTo(0.5);
  });

  it("yields all-zero fractions in canonical order for an empty selection", () => {
    const ranked = rankTribeScores(tableFrom({}));
    expect(ranked.every((r) => r.fraction === 0)).toBe(true);
    expect(ranked.map((r) => r.tribe.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("breaks ties by canonical tribe order (stable)", () => {
    // judah (#1) and benjamin (#6) tie; judah precedes benjamin.
    const ranked = rankTribeScores(tableFrom({ judah: 0.8, benjamin: 0.8 }));
    const judahIdx = ranked.findIndex((r) => r.tribe.slug === "judah");
    const benjaminIdx = ranked.findIndex((r) => r.tribe.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("throws on a score referencing an unknown tribe slug", () => {
    expect(() =>
      rankTribeScores([{ slug: "nope", name: "Nope", score: 1 }]),
    ).toThrow(/unknown tribe slug/i);
  });
});

describe("rankWords", () => {
  it("ranks the dominant tribe first from a realistic selection", () => {
    const leviWords = ["Dedicated", "Devoted"]; // levi-only adjectives
    const ranked = rankWords(leviWords);
    expect(ranked[0].tribe.slug).toBe("levi");
    expect(ranked[0].fraction).toBeCloseTo(1);
  });
});
