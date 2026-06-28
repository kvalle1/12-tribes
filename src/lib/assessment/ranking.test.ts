import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankForDisplay } from "./ranking";

/** A score table over all 12 tribes in canonical order, others defaulting to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankForDisplay", () => {
  it("returns all 12 tribes", () => {
    expect(rankForDisplay(tableFrom({ judah: 0.5 }))).toHaveLength(12);
  });

  it("orders tribes by score, highest first", () => {
    const ranked = rankForDisplay(
      tableFrom({ judah: 0.4, reuben: 0.9, levi: 0.6 }),
    );
    expect(ranked.map((r) => r.slug).slice(0, 3)).toEqual([
      "reuben",
      "levi",
      "judah",
    ]);
  });

  it("expresses each score as a 0–100 percent for the bar width and label", () => {
    const ranked = rankForDisplay(tableFrom({ judah: 0.42 }));
    const judah = ranked.find((r) => r.slug === "judah")!;
    expect(judah.percent).toBeCloseTo(42);
  });

  it("carries each tribe's accent color name through for the bar", () => {
    const ranked = rankForDisplay(tableFrom({ judah: 0.5 }));
    const judah = ranked.find((r) => r.slug === "judah")!;
    expect(judah.color).toBe(tribes.find((t) => t.slug === "judah")!.color);
  });

  it("keeps canonical tribe order for ties (deterministic ranking)", () => {
    // judah (#1) and benjamin (#6) tie; judah keeps the earlier slot.
    const ranked = rankForDisplay(tableFrom({ judah: 0.8, benjamin: 0.8 }));
    const judahIdx = ranked.findIndex((r) => r.slug === "judah");
    const benjaminIdx = ranked.findIndex((r) => r.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("ranks an all-zero profile as all 12 tribes at 0 percent in canonical order", () => {
    const ranked = rankForDisplay(tableFrom({}));
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.percent === 0)).toBe(true);
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});
