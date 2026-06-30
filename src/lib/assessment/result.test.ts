import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { rankTribes, resolveHeadline } from "./result";
import type { TribeScore } from "./score";

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, ranked: ReturnType<typeof rankTribes>) =>
  ranked.find((r) => r.tribe.slug === slug)!;

describe("rankTribes", () => {
  it("returns one row per tribe, sorted by score descending", () => {
    const ranked = rankTribes(
      tableFrom({ judah: 0.4, reuben: 0.9, levi: 0.2 }),
      "reuben",
    );
    expect(ranked).toHaveLength(tribes.length);
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked[0].tribe.slug).toBe("reuben");
  });

  it("attaches the full Tribe object for each row", () => {
    const ranked = rankTribes(tableFrom({ judah: 1 }), "judah");
    const judah = rowFor("judah", ranked);
    expect(judah.tribe.name).toBe("Judah");
    expect(judah.tribe.color).toBe("amber");
  });

  it("makes the bar width proportional to the top-scoring tribe", () => {
    const ranked = rankTribes(
      tableFrom({ judah: 0.5, reuben: 0.25, levi: 0.1 }),
      "judah",
    );
    // The leader fills the bar; others are proportional to it.
    expect(rowFor("judah", ranked).percent).toBeCloseTo(100);
    expect(rowFor("reuben", ranked).percent).toBeCloseTo(50);
    expect(rowFor("levi", ranked).percent).toBeCloseTo(20);
  });

  it("flags the stored Primary and Secondary tribes", () => {
    const ranked = rankTribes(
      tableFrom({ judah: 1, reuben: 0.9, levi: 0.2 }),
      "judah",
      "reuben",
    );
    expect(rowFor("judah", ranked).isPrimary).toBe(true);
    expect(rowFor("judah", ranked).isSecondary).toBe(false);
    expect(rowFor("reuben", ranked).isSecondary).toBe(true);
    expect(rowFor("levi", ranked).isPrimary).toBe(false);
    expect(rowFor("levi", ranked).isSecondary).toBe(false);
  });

  it("marks no Secondary when none was stored", () => {
    const ranked = rankTribes(tableFrom({ judah: 1, reuben: 0.9 }), "judah", null);
    expect(ranked.some((r) => r.isSecondary)).toBe(false);
  });

  it("never divides by zero when every score is 0", () => {
    const ranked = rankTribes(tableFrom({}), "judah");
    expect(ranked).toHaveLength(tribes.length);
    expect(ranked.every((r) => r.percent === 0)).toBe(true);
  });

  it("throws on a score table referencing an unknown tribe slug", () => {
    const bad: TribeScore[] = [{ slug: "nope", name: "Nope", score: 1 }];
    expect(() => rankTribes(bad, "nope")).toThrow();
  });
});

describe("resolveHeadline", () => {
  it("resolves a primary-only result", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.slug).toBe("judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a primary and secondary result", () => {
    const { primary, secondary } = resolveHeadline("judah", "reuben");
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("reuben");
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nope")).toThrow();
  });
});
