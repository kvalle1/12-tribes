import { describe, expect, it } from "vitest";
import type { TribeScore } from "./score";
import { rankScores } from "./ranking";

/** Build a TribeScore quickly; `name` defaults to the slug. */
function s(slug: string, score: number): TribeScore {
  return { slug, name: slug, score };
}

describe("rankScores", () => {
  it("orders tribes highest score first", () => {
    const ranked = rankScores([s("a", 0.2), s("b", 0.8), s("c", 0.5)]);
    expect(ranked.map((r) => r.slug)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("sizes each bar relative to the top score (top is always 100%)", () => {
    const ranked = rankScores([s("a", 0.5), s("b", 1.0), s("c", 0.25)]);
    expect(ranked[0].barPercent).toBe(100); // 1.0 / 1.0
    expect(ranked[1].barPercent).toBe(50); // 0.5 / 1.0
    expect(ranked[2].barPercent).toBe(25); // 0.25 / 1.0
  });

  it("keeps the input's canonical order for ties (stable sort)", () => {
    const ranked = rankScores([s("a", 0.4), s("b", 0.4), s("c", 0.4)]);
    expect(ranked.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("renders every bar at 0% when all scores are 0 (no division by zero)", () => {
    const ranked = rankScores([s("a", 0), s("b", 0)]);
    expect(ranked.every((r) => r.barPercent === 0)).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = [s("a", 0.1), s("b", 0.9)];
    rankScores(input);
    expect(input.map((r) => r.slug)).toEqual(["a", "b"]);
  });
});
