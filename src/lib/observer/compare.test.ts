import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import {
  buildComparison,
  notableDivergences,
  DIVERGENCE_THRESHOLD,
} from "./compare";

/** Build a canonical-order score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, rows: ReturnType<typeof buildComparison>) =>
  rows.find((r) => r.slug === slug)!;

describe("buildComparison", () => {
  it("joins self and others by slug with the signed delta (others - self)", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.8, levi: 0.2 }),
      tableFrom({ judah: 0.4, levi: 0.6 }),
    );
    expect(rowFor("judah", rows)).toMatchObject({ self: 0.8, others: 0.4 });
    expect(rowFor("judah", rows).delta).toBeCloseTo(-0.4);
    expect(rowFor("levi", rows).delta).toBeCloseTo(0.4);
  });

  it("covers all twelve tribes exactly once", () => {
    const rows = buildComparison(tableFrom({ judah: 0.5 }), tableFrom({ levi: 0.5 }));
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(12);
  });

  it("orders by prominence (the larger of self/others) so a tribe others see rises too", () => {
    // Subject barely rates dan; observers rate it top. It should sort first.
    const rows = buildComparison(
      tableFrom({ judah: 0.5, dan: 0.05 }),
      tableFrom({ dan: 0.9 }),
    );
    expect(rows[0].slug).toBe("dan");
  });

  it("scales both bars to one shared max so self and others are comparable", () => {
    const rows = buildComparison(
      tableFrom({ judah: 1.0 }),
      tableFrom({ judah: 0.5 }),
    );
    const judah = rowFor("judah", rows);
    // Shared max is 1.0 → self fills fully, others fills half.
    expect(judah.selfRelative).toBeCloseTo(1);
    expect(judah.othersRelative).toBeCloseTo(0.5);
  });

  it("is all-zero-safe (no division by zero when nobody scored)", () => {
    const rows = buildComparison(tableFrom({}), tableFrom({}));
    expect(rows.every((r) => r.selfRelative === 0 && r.othersRelative === 0)).toBe(
      true,
    );
  });
});

describe("notableDivergences", () => {
  it("keeps only gaps at or above the threshold, largest first", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.9, levi: 0.5, dan: 0.3 }),
      tableFrom({ judah: 0.1, levi: 0.52, dan: 0.9 }),
    );
    const diverged = notableDivergences(rows);
    // judah gap 0.8, dan gap 0.6 are notable; levi gap 0.02 is not.
    expect(diverged.map((r) => r.slug)).toEqual(["judah", "dan"]);
    expect(diverged.some((r) => r.slug === "levi")).toBe(false);
  });

  it("flags a gap just over the threshold and ignores one just under it", () => {
    const justUnder = buildComparison(
      tableFrom({ judah: 0.5, levi: 0.5 }),
      tableFrom({ judah: 0.5 + (DIVERGENCE_THRESHOLD - 0.02) }),
    );
    expect(notableDivergences(justUnder).some((r) => r.slug === "judah")).toBe(
      false,
    );

    const justOver = buildComparison(
      tableFrom({ judah: 0.5, levi: 0.5 }),
      tableFrom({ judah: 0.5 + (DIVERGENCE_THRESHOLD + 0.02) }),
    );
    expect(notableDivergences(justOver).some((r) => r.slug === "judah")).toBe(
      true,
    );
  });

  it("returns nothing when self and others agree closely everywhere", () => {
    const rows = buildComparison(
      tableFrom({ judah: 0.8, levi: 0.4 }),
      tableFrom({ judah: 0.82, levi: 0.38 }),
    );
    expect(notableDivergences(rows)).toEqual([]);
  });
});
