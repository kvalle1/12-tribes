import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { type TribeScore } from "./score";
import { rankTribes, resolveHeadline, accentHex } from "./result";

/** Build a score table for ranking tests, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankTribes", () => {
  it("returns all 12 tribes sorted by score descending", () => {
    const ranked = rankTribes(
      tableFrom({ judah: 0.2, levi: 0.8, dan: 0.5 }),
    );
    expect(ranked).toHaveLength(12);
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked[0].slug).toBe("levi");
    expect(ranked[1].slug).toBe("dan");
  });

  it("sets relative bar width as a fraction of the top score (leader is 1)", () => {
    const ranked = rankTribes(tableFrom({ levi: 0.8, dan: 0.4 }));
    expect(ranked[0].relative).toBeCloseTo(1);
    const dan = ranked.find((r) => r.slug === "dan")!;
    expect(dan.relative).toBeCloseTo(0.5);
  });

  it("gives every tribe relative 0 when no words scored (no divide-by-zero)", () => {
    const ranked = rankTribes(tableFrom({}));
    expect(ranked.every((r) => r.relative === 0)).toBe(true);
  });

  it("enriches each row with the tribe's display metadata and accent hex", () => {
    const ranked = rankTribes(tableFrom({ judah: 1 }));
    const judah = ranked.find((r) => r.slug === "judah")!;
    expect(judah.name).toBe("Judah");
    expect(judah.callSign).toBe("The Lion");
    expect(judah.accent).toBe(accentHex("amber"));
  });

  it("keeps canonical tribe order for ties", () => {
    // All equal → output order must match the canonical tribes array.
    const ranked = rankTribes(tableFrom({}));
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("accentHex", () => {
  it("maps every tribe's color to a hex value (no silent brass fallback)", () => {
    const fallback = accentHex("__nonexistent__");
    for (const tribe of tribes) {
      expect(accentHex(tribe.color)).not.toBe(fallback);
    }
  });
});

describe("resolveHeadline", () => {
  it("resolves primary and optional secondary slugs to full tribes", () => {
    const { primary, secondary } = resolveHeadline("judah", "levi");
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("levi");
  });

  it("omits the secondary when no slug is given", () => {
    const { secondary } = resolveHeadline("judah", null);
    expect(secondary).toBeUndefined();
  });
});
