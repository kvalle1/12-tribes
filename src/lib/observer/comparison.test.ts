import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { buildComparison, topDivergences } from "./comparison";

/** Build a full 12-tribe score table from a slug→score override map. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, rows: { slug: string }[]) =>
  rows.find((r) => r.slug === slug)!;

describe("buildComparison", () => {
  it("returns one row per tribe carrying both scores and their gap", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.8, levi: 0.4 }),
      tableFrom({ judah: 0.5, levi: 0.6 }),
    );
    expect(rows).toHaveLength(12);

    const judah = rowFor("judah", rows);
    expect(judah.selfScore).toBeCloseTo(0.8);
    expect(judah.othersScore).toBeCloseTo(0.5);
    expect(judah.gap).toBeCloseTo(0.3);

    const levi = rowFor("levi", rows);
    expect(levi.gap).toBeCloseTo(-0.2);
  });

  it("orders rows by the stronger of the two reads, highest first", () => {
    // others see Levi strongest; self sees Judah strongest — Levi (0.9) leads.
    const rows = buildComparison(
      tableFrom({ judah: 0.6, levi: 0.1 }),
      tableFrom({ judah: 0.2, levi: 0.9 }),
    );
    expect(rows[0].slug).toBe("levi");
    expect(rows[1].slug).toBe("judah");
  });

  it("draws both bars against one shared maximum", () => {
    const rows = buildComparison(
      tableFrom({ judah: 1.0 }),
      tableFrom({ levi: 0.5 }),
    );
    expect(rowFor("judah", rows).selfRelative).toBeCloseTo(1); // top overall
    expect(rowFor("levi", rows).othersRelative).toBeCloseTo(0.5); // half of max
    expect(rowFor("judah", rows).othersRelative).toBe(0);
  });

  it("is all-zero relative fills when nobody scored anything", () => {
    const rows = buildComparison(tableFrom({}), tableFrom({}));
    expect(rows.every((r) => r.selfRelative === 0 && r.othersRelative === 0)).toBe(
      true,
    );
  });

  it("does not mutate its inputs", () => {
    const self = tableFrom({ judah: 0.8 });
    const others = tableFrom({ levi: 0.5 });
    const selfSnapshot = self.map((s) => s.slug);
    buildComparison(self, others);
    expect(self.map((s) => s.slug)).toEqual(selfSnapshot);
  });
});

describe("topDivergences", () => {
  it("surfaces the largest absolute gaps first", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.9, levi: 0.5, reuben: 0.3 }),
      tableFrom({ judah: 0.2, levi: 0.5, reuben: 0.4 }),
    );
    const top = topDivergences(rows, 2);
    expect(top[0].slug).toBe("judah"); // gap 0.7
    expect(top.map((r) => r.slug)).not.toContain("levi"); // gap 0 → excluded
  });

  it("excludes perfectly aligned tribes (gap 0)", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.5 }),
      tableFrom({ judah: 0.5 }),
    );
    expect(topDivergences(rows)).toHaveLength(0);
  });

  it("treats a sub-epsilon float gap as aligned, not a divergence", () => {
    // Self and others reach ~0.3 by different float paths; the residual gap is
    // a rounding artifact, not a real divergence, so it must not surface.
    const rows = buildComparison(
      tableFrom({ judah: 0.1 + 0.2 }),
      tableFrom({ judah: 0.3 }),
    );
    const judah = rowFor("judah", rows);
    expect(judah.gap).not.toBe(0); // the artifact is genuinely non-zero
    expect(topDivergences(rows)).toHaveLength(0);
  });

  it("respects the limit", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.9, levi: 0.8, reuben: 0.7, simeon: 0.6 }),
      tableFrom({ judah: 0.1, levi: 0.2, reuben: 0.3, simeon: 0.4 }),
    );
    expect(topDivergences(rows, 2)).toHaveLength(2);
  });
});
