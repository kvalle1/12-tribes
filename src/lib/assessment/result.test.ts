import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { resolveHeadline, buildRanking } from "./result";

/** Build a score table in canonical tribe order, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const bySlug = (ranked: ReturnType<typeof buildRanking>, slug: string) =>
  ranked.find((r) => r.tribe.slug === slug)!;

describe("resolveHeadline", () => {
  it("resolves the primary slug to its full tribe", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.slug).toBe("judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a secondary when its slug is given", () => {
    const { secondary } = resolveHeadline("judah", "reuben");
    expect(secondary?.slug).toBe("reuben");
  });

  it("treats a null secondary slug as no secondary", () => {
    expect(resolveHeadline("judah", null).secondary).toBeUndefined();
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nosuchtribe")).toThrow();
  });
});

describe("buildRanking", () => {
  it("returns one entry per tribe (all 12)", () => {
    const ranked = buildRanking(tableFrom({ judah: 0.5 }), "judah");
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.tribe.slug)).size).toBe(12);
  });

  it("sorts by score descending", () => {
    const ranked = buildRanking(
      tableFrom({ judah: 0.4, reuben: 0.9, levi: 0.7 }),
      "reuben",
    );
    expect(ranked[0].tribe.slug).toBe("reuben");
    expect(ranked[1].tribe.slug).toBe("levi");
    expect(ranked[2].tribe.slug).toBe("judah");
    const scores = ranked.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("assigns 1-based ranks in sorted order", () => {
    const ranked = buildRanking(
      tableFrom({ judah: 0.4, reuben: 0.9 }),
      "reuben",
    );
    expect(ranked.map((r) => r.rank)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("breaks ties by canonical tribe order", () => {
    // judah (#1) and benjamin (#6) tie; judah comes first by canonical order.
    const ranked = buildRanking(
      tableFrom({ judah: 0.8, benjamin: 0.8 }),
      "judah",
    );
    const judahIdx = ranked.findIndex((r) => r.tribe.slug === "judah");
    const benjaminIdx = ranked.findIndex((r) => r.tribe.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("scales bar fractions relative to the top score (top fills the bar)", () => {
    const ranked = buildRanking(
      tableFrom({ judah: 1.0, reuben: 0.5 }),
      "judah",
    );
    expect(bySlug(ranked, "judah").fraction).toBeCloseTo(1);
    expect(bySlug(ranked, "reuben").fraction).toBeCloseTo(0.5);
  });

  it("yields all-zero fractions (no divide-by-zero) when nothing scored", () => {
    const ranked = buildRanking(tableFrom({}), "judah");
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.fraction === 0)).toBe(true);
  });

  it("exposes a rounded percentage of the normalized score for display", () => {
    const ranked = buildRanking(
      tableFrom({ judah: 0.5, reuben: 0.125 }),
      "judah",
    );
    expect(bySlug(ranked, "judah").percent).toBe(50);
    expect(bySlug(ranked, "reuben").percent).toBe(13);
  });

  it("flags the primary and secondary tribes and nothing else", () => {
    const ranked = buildRanking(
      tableFrom({ judah: 1.0, reuben: 0.9, levi: 0.2 }),
      "judah",
      "reuben",
    );
    expect(bySlug(ranked, "judah").isPrimary).toBe(true);
    expect(bySlug(ranked, "reuben").isSecondary).toBe(true);
    expect(ranked.filter((r) => r.isPrimary)).toHaveLength(1);
    expect(ranked.filter((r) => r.isSecondary)).toHaveLength(1);
    expect(bySlug(ranked, "levi").isPrimary).toBe(false);
    expect(bySlug(ranked, "levi").isSecondary).toBe(false);
  });

  it("carries full tribe metadata on each entry", () => {
    const ranked = buildRanking(tableFrom({ judah: 0.5 }), "judah");
    const judah = bySlug(ranked, "judah");
    expect(judah.tribe.name).toBe("Judah");
    expect(judah.tribe.color).toBeTruthy();
    expect(judah.tribe.hebrew).toBeTruthy();
  });
});
