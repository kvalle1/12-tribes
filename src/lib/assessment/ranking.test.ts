import { describe, expect, it } from "vitest";
import type { TribeScore } from "./score";
import { rankForDisplay } from "./ranking";

function s(slug: string, score: number): TribeScore {
  return { slug, name: slug, score };
}

describe("rankForDisplay", () => {
  it("sorts tribes by score descending", () => {
    const ranked = rankForDisplay([s("a", 0.2), s("b", 0.8), s("c", 0.5)]);
    expect(ranked.map((r) => r.slug)).toEqual(["b", "c", "a"]);
  });

  it("gives the leader a full-width bar and scales the rest proportionally", () => {
    const ranked = rankForDisplay([s("a", 0.25), s("b", 0.5), s("c", 0)]);
    const byslug = Object.fromEntries(ranked.map((r) => [r.slug, r.widthPct]));
    expect(byslug.b).toBe(100); // leader
    expect(byslug.a).toBe(50); // half the leader
    expect(byslug.c).toBe(0); // no points earned
  });

  it("keeps every input tribe so all 12 always render", () => {
    const scores = Array.from({ length: 12 }, (_, i) => s(`t${i}`, i / 100));
    expect(rankForDisplay(scores)).toHaveLength(12);
  });

  it("preserves input order for ties (stable, canonical)", () => {
    const ranked = rankForDisplay([s("a", 0.5), s("b", 0.5), s("c", 0.5)]);
    expect(ranked.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("renders zero-width bars when no tribe scored, without dividing by zero", () => {
    const ranked = rankForDisplay([s("a", 0), s("b", 0)]);
    expect(ranked.every((r) => r.widthPct === 0)).toBe(true);
  });

  it("exposes the percent of available points earned for each tribe", () => {
    const ranked = rankForDisplay([s("a", 0.25), s("b", 0.5)]);
    const byslug = Object.fromEntries(ranked.map((r) => [r.slug, r.percent]));
    expect(byslug.b).toBe(50);
    expect(byslug.a).toBe(25);
  });
});
