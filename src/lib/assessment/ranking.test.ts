import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankTribeBars } from "./ranking";

/** Build a full 12-tribe score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankTribeBars", () => {
  it("returns every tribe, ranked by score descending", () => {
    const bars = rankTribeBars(
      tableFrom({ judah: 0.4, dan: 0.9, levi: 0.6 }),
    );
    expect(bars).toHaveLength(tribes.length);
    expect(bars.map((b) => b.slug).slice(0, 3)).toEqual(["dan", "levi", "judah"]);
    // Sorted descending overall.
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i - 1].score).toBeGreaterThanOrEqual(bars[i].score);
    }
  });

  it("expresses the normalized score as a rounded percentage label", () => {
    const bars = rankTribeBars(tableFrom({ judah: 0.5, dan: 0.333 }));
    const judah = bars.find((b) => b.slug === "judah")!;
    const dan = bars.find((b) => b.slug === "dan")!;
    expect(judah.scorePct).toBe(50);
    expect(dan.scorePct).toBe(33);
  });

  it("scales bar width relative to the top tribe so the leader fills the track", () => {
    const bars = rankTribeBars(tableFrom({ judah: 0.8, dan: 0.4 }));
    expect(bars[0].barPct).toBe(100);
    const dan = bars.find((b) => b.slug === "dan")!;
    expect(dan.barPct).toBeCloseTo(50);
  });

  it("never divides by zero when every tribe scored zero", () => {
    const bars = rankTribeBars(tableFrom({}));
    expect(bars).toHaveLength(tribes.length);
    expect(bars.every((b) => b.barPct === 0)).toBe(true);
    expect(bars.every((b) => b.scorePct === 0)).toBe(true);
  });

  it("preserves slug and name from the input scores", () => {
    const bars = rankTribeBars(tableFrom({ judah: 0.7 }));
    const judah = bars.find((b) => b.slug === "judah")!;
    expect(judah.name).toBe("Judah");
  });

  it("keeps canonical tribe order for ties (stable sort)", () => {
    // All equal → output order matches input (canonical number) order.
    const input = tableFrom(
      Object.fromEntries(tribes.map((t) => [t.slug, 0.25])),
    );
    const bars = rankTribeBars(input);
    expect(bars.map((b) => b.slug)).toEqual(tribes.map((t) => t.slug));
  });
});
