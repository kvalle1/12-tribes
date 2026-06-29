import { describe, expect, it } from "vitest";
import { rankScores } from "./ranking";
import type { TribeScore } from "./score";

const s = (slug: string, score: number): TribeScore => ({
  slug,
  name: slug,
  score,
});

describe("rankScores", () => {
  it("orders tribes by score descending", () => {
    const ranked = rankScores([s("a", 0.2), s("b", 0.6), s("c", 0.4)]);
    expect(ranked.map((r) => r.slug)).toEqual(["b", "c", "a"]);
  });

  it("gives the top tribe a full-width bar (relative 1)", () => {
    const ranked = rankScores([s("a", 0.5), s("b", 0.25)]);
    expect(ranked[0].relative).toBe(1);
  });

  it("makes the bar fraction proportional to the top score", () => {
    const ranked = rankScores([s("a", 0.6), s("b", 0.3), s("c", 0.15)]);
    expect(ranked[1].relative).toBeCloseTo(0.5);
    expect(ranked[2].relative).toBeCloseTo(0.25);
  });

  it("returns relative 0 for every tribe when all scores are 0", () => {
    const ranked = rankScores([s("a", 0), s("b", 0)]);
    expect(ranked.every((r) => r.relative === 0)).toBe(true);
  });

  it("keeps the input (canonical) order for tied scores", () => {
    const ranked = rankScores([s("a", 0.4), s("b", 0.4), s("c", 0.4)]);
    expect(ranked.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = [s("a", 0.2), s("b", 0.6)];
    rankScores(input);
    expect(input.map((r) => r.slug)).toEqual(["a", "b"]);
  });
});
