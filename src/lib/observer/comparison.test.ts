import { describe, it, expect } from "vitest";
import type { TribeScore } from "@/lib/assessment/score";
import { buildComparison } from "./comparison";

/** Build a sparse score table; unlisted tribes default to 0. */
const table = (overrides: Record<string, number>): TribeScore[] =>
  Object.entries(overrides).map(([slug, score]) => ({
    slug,
    name: slug,
    score,
  }));

const row = (rows: ReturnType<typeof buildComparison>, slug: string) =>
  rows.find((r) => r.slug === slug)!;

describe("buildComparison", () => {
  it("carries self, others, and the others−self gap per tribe", () => {
    const rows = buildComparison(
      table({ judah: 0.8, levi: 0.2 }),
      table({ judah: 0.5, levi: 0.6 }),
    );
    expect(row(rows, "judah").self).toBeCloseTo(0.8);
    expect(row(rows, "judah").others).toBeCloseTo(0.5);
    expect(row(rows, "judah").gap).toBeCloseTo(-0.3);
    expect(row(rows, "levi").gap).toBeCloseTo(0.4);
  });

  it("defaults others to 0 for a tribe absent from the others profile", () => {
    const rows = buildComparison(table({ judah: 0.8 }), table({}));
    expect(row(rows, "judah").others).toBe(0);
    expect(row(rows, "judah").gap).toBeCloseTo(-0.8);
  });

  it("ranks by the stronger of the two sides, highest first", () => {
    // levi is low for self but the strongest signal in the others profile, so it
    // should rank ahead of judah which is only moderate on both sides.
    const rows = buildComparison(
      table({ judah: 0.5, levi: 0.1 }),
      table({ judah: 0.4, levi: 0.9 }),
    );
    expect(rows[0].slug).toBe("levi");
  });

  it("scales both bars against one shared max so self and others are comparable", () => {
    const rows = buildComparison(
      table({ judah: 1.0, levi: 0.5 }),
      table({ judah: 0.5, levi: 0.25 }),
    );
    // Shared max is judah-self = 1.0.
    expect(row(rows, "judah").selfRelative).toBeCloseTo(1);
    expect(row(rows, "judah").othersRelative).toBeCloseTo(0.5);
    expect(row(rows, "levi").selfRelative).toBeCloseTo(0.5);
    expect(row(rows, "levi").othersRelative).toBeCloseTo(0.25);
  });

  it("returns zero bar fills when both profiles are all zero", () => {
    const rows = buildComparison(table({ judah: 0 }), table({ judah: 0 }));
    expect(row(rows, "judah").selfRelative).toBe(0);
    expect(row(rows, "judah").othersRelative).toBe(0);
  });

  it("does not mutate its inputs", () => {
    const self = table({ judah: 0.8, levi: 0.2 });
    const others = table({ judah: 0.5 });
    const selfCopy = structuredClone(self);
    const othersCopy = structuredClone(others);
    buildComparison(self, others);
    expect(self).toEqual(selfCopy);
    expect(others).toEqual(othersCopy);
  });
});
