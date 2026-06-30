import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankedBars } from "./result";

/** Build a score table in canonical order, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankedBars", () => {
  it("returns one bar per tribe, ranked by score descending", () => {
    const bars = rankedBars(
      tableFrom({ judah: 0.4, levi: 0.9, dan: 0.1 }),
      "levi",
    );
    expect(bars).toHaveLength(tribes.length);
    expect(bars.map((b) => b.slug).slice(0, 3)).toEqual(["levi", "judah", "dan"]);
    // Scores are monotonically non-increasing.
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i - 1].score).toBeGreaterThanOrEqual(bars[i].score);
    }
  });

  it("keeps canonical (tribe number) order for ties", () => {
    // Judah (#1) and Levi (#2) tie; canonical order must be preserved.
    const bars = rankedBars(tableFrom({ judah: 0.5, levi: 0.5 }), "judah");
    const tied = bars.filter((b) => b.score === 0.5).map((b) => b.slug);
    expect(tied).toEqual(["judah", "levi"]);
  });

  it("scales bar fractions relative to the top tribe", () => {
    const bars = rankedBars(tableFrom({ levi: 0.8, judah: 0.4 }), "levi");
    expect(bars[0].fraction).toBeCloseTo(1);
    expect(bars[1].fraction).toBeCloseTo(0.5);
    // Zero-scoring tribes have a zero-width bar.
    expect(bars.at(-1)!.fraction).toBe(0);
  });

  it("does not divide by zero when every score is zero", () => {
    const bars = rankedBars(tableFrom({}), "judah");
    expect(bars.every((b) => b.fraction === 0)).toBe(true);
  });

  it("flags the primary and secondary tribes", () => {
    const bars = rankedBars(
      tableFrom({ judah: 0.9, levi: 0.7, dan: 0.2 }),
      "judah",
      "levi",
    );
    const primary = bars.find((b) => b.isPrimary)!;
    const secondary = bars.find((b) => b.isSecondary)!;
    expect(primary.slug).toBe("judah");
    expect(secondary.slug).toBe("levi");
    // Exactly one of each; everything else is neither.
    expect(bars.filter((b) => b.isPrimary)).toHaveLength(1);
    expect(bars.filter((b) => b.isSecondary)).toHaveLength(1);
  });

  it("marks no secondary when none is given", () => {
    const bars = rankedBars(tableFrom({ judah: 0.9 }), "judah");
    expect(bars.some((b) => b.isSecondary)).toBe(false);
  });

  it("carries each tribe's accent color name and display name", () => {
    const bars = rankedBars(tableFrom({ judah: 0.9 }), "judah");
    const judah = bars.find((b) => b.slug === "judah")!;
    const source = tribes.find((t) => t.slug === "judah")!;
    expect(judah.color).toBe(source.color);
    expect(judah.name).toBe(source.name);
  });
});
