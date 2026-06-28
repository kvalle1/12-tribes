import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankScores } from "./ranking";

/** Build a score table for all 12 tribes, defaulting unspecified tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankScores", () => {
  it("returns every tribe, ranked by score descending", () => {
    const ranked = rankScores(
      tableFrom({ judah: 0.2, levi: 0.8, dan: 0.5 }),
      "levi",
    );
    expect(ranked).toHaveLength(tribes.length);
    expect(ranked.map((r) => r.slug).slice(0, 3)).toEqual([
      "levi",
      "dan",
      "judah",
    ]);
    // Scores are monotonically non-increasing down the list.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }
  });

  it("preserves canonical (tribe number) order when scores tie", () => {
    // Two tribes tie; the one earlier in canonical order ranks first.
    const all = tableFrom({});
    const ranked = rankScores(all, all[0].slug);
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("sizes bars relative to the top score, with the leader at full width", () => {
    const ranked = rankScores(
      tableFrom({ judah: 0.5, levi: 0.25, dan: 0.1 }),
      "judah",
    );
    const byslug = Object.fromEntries(ranked.map((r) => [r.slug, r]));
    expect(byslug.judah.barFraction).toBeCloseTo(1);
    expect(byslug.levi.barFraction).toBeCloseTo(0.5);
    expect(byslug.dan.barFraction).toBeCloseTo(0.2);
  });

  it("renders empty bars (no NaN) when every score is zero", () => {
    const ranked = rankScores(tableFrom({}), "judah");
    expect(ranked.every((r) => r.barFraction === 0)).toBe(true);
    expect(ranked.every((r) => r.percent === 0)).toBe(true);
  });

  it("exposes the normalized score as a rounded percentage label", () => {
    const ranked = rankScores(tableFrom({ judah: 0.5, levi: 0.123 }), "judah");
    const byslug = Object.fromEntries(ranked.map((r) => [r.slug, r]));
    expect(byslug.judah.percent).toBe(50);
    expect(byslug.levi.percent).toBe(12);
  });

  it("flags the primary and secondary tribes by slug", () => {
    const ranked = rankScores(
      tableFrom({ judah: 0.5, levi: 0.4, dan: 0.1 }),
      "judah",
      "levi",
    );
    const byslug = Object.fromEntries(ranked.map((r) => [r.slug, r]));
    expect(byslug.judah.isPrimary).toBe(true);
    expect(byslug.judah.isSecondary).toBe(false);
    expect(byslug.levi.isSecondary).toBe(true);
    expect(byslug.levi.isPrimary).toBe(false);
    expect(byslug.dan.isPrimary).toBe(false);
    expect(byslug.dan.isSecondary).toBe(false);
  });

  it("treats a null/absent secondary as no secondary", () => {
    const ranked = rankScores(tableFrom({ judah: 0.5 }), "judah", null);
    expect(ranked.every((r) => r.isSecondary === false)).toBe(true);
  });
});
