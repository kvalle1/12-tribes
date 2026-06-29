import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { buildRanking, resolveHeadline } from "./result";
import type { TribeScore } from "./score";

/** Build a synthetic, canonically-ordered score table, defaulting unset tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("buildRanking", () => {
  it("returns every one of the 12 tribes", () => {
    const ranking = buildRanking(tableFrom({}));
    expect(ranking).toHaveLength(12);
    expect(new Set(ranking.map((r) => r.tribe.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
  });

  it("orders the tribes by normalized score, highest first", () => {
    const ranking = buildRanking(
      tableFrom({ judah: 0.4, dan: 0.9, asher: 0.6 }),
    );
    expect(ranking.slice(0, 3).map((r) => r.tribe.slug)).toEqual([
      "dan",
      "asher",
      "judah",
    ]);
    const scoresDesc = ranking.map((r) => r.score);
    expect([...scoresDesc].sort((a, b) => b - a)).toEqual(scoresDesc);
  });

  it("breaks score ties by canonical tribe order", () => {
    // Judah (#1) and Benjamin (#12) both score 0.5 — Judah must come first.
    const ranking = buildRanking(tableFrom({ judah: 0.5, benjamin: 0.5 }));
    const tied = ranking.filter((r) => r.score === 0.5).map((r) => r.tribe.slug);
    expect(tied).toEqual(["judah", "benjamin"]);
  });

  it("resolves each entry to its full Tribe object with the accent color", () => {
    const [top] = buildRanking(tableFrom({ judah: 0.8 }));
    expect(top.tribe.name).toBe("Judah");
    expect(top.tribe.color).toBe("amber");
  });

  it("exposes a 0–100 integer percent for display and bar width", () => {
    const ranking = buildRanking(tableFrom({ judah: 0.625, dan: 0 }));
    const judah = ranking.find((r) => r.tribe.slug === "judah")!;
    expect(judah.percent).toBe(63);
    const dan = ranking.find((r) => r.tribe.slug === "dan")!;
    expect(dan.percent).toBe(0);
  });

  it("throws on an unknown tribe slug rather than rendering a phantom row", () => {
    expect(() =>
      buildRanking([{ slug: "nope", name: "Nope", score: 0.5 }]),
    ).toThrow(/nope/);
  });
});

describe("resolveHeadline", () => {
  it("resolves a primary-only result", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.slug).toBe("judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a primary and secondary", () => {
    const { primary, secondary } = resolveHeadline("judah", "dan");
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("dan");
  });
});
