import { describe, expect, it } from "vitest";
import type { TribeScore } from "./score";
import { toRankedBars } from "./ranking";

/** Build a minimal TribeScore for a test case. */
function s(slug: string, score: number): TribeScore {
  return { slug, name: slug, score };
}

describe("toRankedBars", () => {
  it("returns every input tribe, ranked by score descending", () => {
    const bars = toRankedBars([s("a", 0.2), s("b", 0.8), s("c", 0.5)]);
    expect(bars.map((b) => b.slug)).toEqual(["b", "c", "a"]);
    expect(bars).toHaveLength(3);
  });

  it("keeps the input order for ties (stable, mirrors deriveResult)", () => {
    const bars = toRankedBars([s("a", 0.5), s("b", 0.5), s("c", 0.5)]);
    expect(bars.map((b) => b.slug)).toEqual(["a", "b", "c"]);
  });

  it("reports each score as a rounded 0–100 percentage for display", () => {
    const bars = toRankedBars([s("a", 0.5), s("b", 0.333)]);
    expect(bars.find((b) => b.slug === "a")?.percent).toBe(50);
    expect(bars.find((b) => b.slug === "b")?.percent).toBe(33);
  });

  it("scales bar width proportionally, the top score filling the track", () => {
    const bars = toRankedBars([s("a", 0.8), s("b", 0.4), s("c", 0.2)]);
    expect(bars[0].relativeWidth).toBe(100);
    expect(bars[1].relativeWidth).toBeCloseTo(50);
    expect(bars[2].relativeWidth).toBeCloseTo(25);
  });

  it("handles an all-zero selection without dividing by zero", () => {
    const bars = toRankedBars([s("a", 0), s("b", 0)]);
    expect(bars.every((b) => b.percent === 0)).toBe(true);
    expect(bars.every((b) => b.relativeWidth === 0)).toBe(true);
    expect(bars.map((b) => b.slug)).toEqual(["a", "b"]);
  });
});
