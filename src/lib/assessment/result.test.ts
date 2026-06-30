import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { resolveHeadline, rankScores } from "./result";

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("resolveHeadline", () => {
  it("resolves a primary slug to its full Tribe", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.slug).toBe("judah");
    expect(primary.name).toBe("Judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a secondary slug when given", () => {
    const { secondary } = resolveHeadline("judah", "reuben");
    expect(secondary?.slug).toBe("reuben");
  });

  it("ignores a null/empty secondary slug", () => {
    expect(resolveHeadline("judah", null).secondary).toBeUndefined();
    expect(resolveHeadline("judah", "").secondary).toBeUndefined();
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nope")).toThrow();
  });
});

describe("rankScores", () => {
  it("returns all 12 tribes sorted by score descending", () => {
    const ranked = rankScores(tableFrom({ levi: 0.2, judah: 0.9, reuben: 0.5 }));
    expect(ranked).toHaveLength(12);
    expect(ranked[0].tribe.slug).toBe("judah");
    expect(ranked[1].tribe.slug).toBe("reuben");
    expect(ranked[2].tribe.slug).toBe("levi");
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("attaches the full Tribe object for each entry", () => {
    const ranked = rankScores(tableFrom({ judah: 1 }));
    expect(ranked[0].tribe.color).toBe("amber");
    expect(ranked[0].tribe.callSign).toBe("The Lion");
  });

  it("gives the leader a full bar and scales the rest proportionally", () => {
    const ranked = rankScores(tableFrom({ judah: 0.8, reuben: 0.4, levi: 0.2 }));
    expect(ranked[0].barFraction).toBeCloseTo(1);
    expect(ranked[1].barFraction).toBeCloseTo(0.5);
    expect(ranked[2].barFraction).toBeCloseTo(0.25);
  });

  it("uses a zero bar fraction for every tribe when nothing scored", () => {
    const ranked = rankScores(tableFrom({}));
    expect(ranked.every((r) => r.barFraction === 0)).toBe(true);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });

  it("breaks ties by canonical tribe order", () => {
    // judah (#1) and benjamin (#6) tie — judah ranks first.
    const ranked = rankScores(tableFrom({ judah: 0.5, benjamin: 0.5 }));
    const judahIdx = ranked.findIndex((r) => r.tribe.slug === "judah");
    const benjaminIdx = ranked.findIndex((r) => r.tribe.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });
});
