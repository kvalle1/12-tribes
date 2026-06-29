import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { rankTribes } from "./ranking";
import type { TribeScore } from "./score";

/**
 * `rankTribes` is the pure presentation helper behind the result page's 12-tribe
 * ranking bars (issue #6). It turns the scoring core's per-tribe scores into a
 * ranked, display-ready list — ordered high→low, each row carrying the bar width
 * (relative to the leader) and a Primary/Secondary flag for accenting. Tested
 * here through its public output only.
 */

function scoresFromMap(map: Record<string, number>): TribeScore[] {
  // Build a full 12-tribe score list in canonical order, defaulting to 0.
  return tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: map[t.slug] ?? 0,
  }));
}

describe("rankTribes", () => {
  it("returns every one of the 12 tribes", () => {
    const ranked = rankTribes(scoresFromMap({}), "judah");
    expect(ranked).toHaveLength(tribes.length);
    expect(new Set(ranked.map((r) => r.slug)).size).toBe(tribes.length);
  });

  it("orders tribes by score, highest first", () => {
    const ranked = rankTribes(
      scoresFromMap({ judah: 0.2, levi: 0.8, dan: 0.5 }),
      "levi",
    );
    const scores = ranked.map((r) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    expect(ranked[0].slug).toBe("levi");
  });

  it("gives the leader a full bar and scales the rest proportionally", () => {
    const ranked = rankTribes(
      scoresFromMap({ levi: 0.8, dan: 0.4, judah: 0.2 }),
      "levi",
    );
    const bySlug = Object.fromEntries(ranked.map((r) => [r.slug, r]));
    expect(bySlug.levi.barFraction).toBeCloseTo(1);
    expect(bySlug.dan.barFraction).toBeCloseTo(0.5);
    expect(bySlug.judah.barFraction).toBeCloseTo(0.25);
  });

  it("exposes a rounded 0–100 percentage for display", () => {
    const ranked = rankTribes(scoresFromMap({ levi: 0.333 }), "levi");
    const levi = ranked.find((r) => r.slug === "levi")!;
    expect(levi.percent).toBe(33);
  });

  it("flags the primary and secondary tribes", () => {
    const ranked = rankTribes(
      scoresFromMap({ levi: 0.8, dan: 0.6 }),
      "levi",
      "dan",
    );
    const levi = ranked.find((r) => r.slug === "levi")!;
    const dan = ranked.find((r) => r.slug === "dan")!;
    const other = ranked.find((r) => r.slug === "judah")!;
    expect(levi.isPrimary).toBe(true);
    expect(levi.isSecondary).toBe(false);
    expect(dan.isSecondary).toBe(true);
    expect(dan.isPrimary).toBe(false);
    expect(other.isPrimary).toBe(false);
    expect(other.isSecondary).toBe(false);
  });

  it("has no secondary flagged when none was derived", () => {
    const ranked = rankTribes(scoresFromMap({ levi: 0.8 }), "levi");
    expect(ranked.some((r) => r.isSecondary)).toBe(false);
  });

  it("handles an all-zero profile without dividing by zero", () => {
    const ranked = rankTribes(scoresFromMap({}), "judah");
    expect(ranked.every((r) => r.barFraction === 0)).toBe(true);
    expect(ranked.every((r) => r.percent === 0)).toBe(true);
  });

  it("breaks score ties by canonical tribe order", () => {
    // judah (#1) and reuben (#2 in canonical order) tie; canonical order wins.
    const ranked = rankTribes(
      scoresFromMap({ judah: 0.5, reuben: 0.5 }),
      "judah",
    );
    const judahIdx = ranked.findIndex((r) => r.slug === "judah");
    const reubenIdx = ranked.findIndex((r) => r.slug === "reuben");
    const judahNum = tribes.find((t) => t.slug === "judah")!.number;
    const reubenNum = tribes.find((t) => t.slug === "reuben")!.number;
    // Whichever has the lower canonical number ranks first among the tie.
    expect(judahIdx < reubenIdx).toBe(judahNum < reubenNum);
  });
});
