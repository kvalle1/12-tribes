import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { buildComparison } from "./comparison";

/** Build a score table for the 12 tribes, defaulting unmentioned ones to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("buildComparison", () => {
  it("returns one row per tribe with self and others scores", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.8 }),
      tableFrom({ judah: 0.4 }),
    );
    expect(rows).toHaveLength(12);
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.selfScore).toBeCloseTo(0.8);
    expect(judah.othersScore).toBeCloseTo(0.4);
  });

  it("reports the gap as others minus self (positive = others see it more)", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.8, levi: 0.2 }),
      tableFrom({ judah: 0.3, levi: 0.7 }),
    );
    expect(rows.find((r) => r.slug === "judah")!.gap).toBeCloseTo(-0.5);
    expect(rows.find((r) => r.slug === "levi")!.gap).toBeCloseTo(0.5);
  });

  it("ranks rows by the stronger of the two scores, highest first", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.2, levi: 0.9 }),
      tableFrom({ judah: 0.5, levi: 0.1 }),
    );
    // levi peaks at 0.9 (self), judah peaks at 0.5 (others) → levi outranks judah.
    expect(rows[0].slug).toBe("levi");
    expect(rows[1].slug).toBe("judah");
  });

  it("breaks ranking ties by canonical tribe order", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.5, benjamin: 0.5 }),
      tableFrom({}),
    );
    const judahIdx = rows.findIndex((r) => r.slug === "judah");
    const benjaminIdx = rows.findIndex((r) => r.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("scales both bars against a shared maximum so the two series are comparable", () => {
    const rows = buildComparison(
      tableFrom({ judah: 1.0, levi: 0.5 }),
      tableFrom({ judah: 0.5, levi: 0.25 }),
    );
    const judah = rows.find((r) => r.slug === "judah")!;
    const levi = rows.find((r) => r.slug === "levi")!;
    // Shared max is Judah-self at 1.0 → it fills the bar; everything else is a
    // fraction of that same scale, so self and others bars are directly readable.
    expect(judah.selfRelative).toBeCloseTo(1);
    expect(judah.othersRelative).toBeCloseTo(0.5);
    expect(levi.selfRelative).toBeCloseTo(0.5);
    expect(levi.othersRelative).toBeCloseTo(0.25);
  });

  it("stays at zero fill when nothing scored (no divide by zero)", () => {
    const rows = buildComparison(tableFrom({}), tableFrom({}));
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row.selfRelative).toBe(0);
      expect(row.othersRelative).toBe(0);
    }
  });
});
