import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { compareProfiles, largestDivergences } from "./comparison";

/** Build a score table from slug→score overrides, defaulting others to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, rows: { slug: string }[]) =>
  rows.find((r) => r.slug === slug)!;

describe("compareProfiles", () => {
  it("pairs self and others per tribe in canonical order", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.8 }),
      tableFrom({ judah: 0.4 }),
    );
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("computes delta as others minus self", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.8, levi: 0.2 }),
      tableFrom({ judah: 0.5, levi: 0.6 }),
    );
    const judah = rowFor("judah", rows);
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.5);
    expect(judah.delta).toBeCloseTo(-0.3); // others see judah less than self
    expect(judah.divergence).toBeCloseTo(0.3);

    const levi = rowFor("levi", rows);
    expect(levi.delta).toBeCloseTo(0.4); // others see levi more than self
    expect(levi.divergence).toBeCloseTo(0.4);
  });

  it("treats a tribe missing from one side as scoring zero there", () => {
    const rows = compareProfiles(
      [{ slug: "judah", name: "Judah", score: 0.9 }],
      [{ slug: "levi", name: "Levi", score: 0.7 }],
    );
    expect(rowFor("judah", rows).others).toBe(0);
    expect(rowFor("levi", rows).self).toBe(0);
    expect(rows.map((r) => r.slug)).toEqual(["judah", "levi"]);
  });
});

describe("largestDivergences", () => {
  it("returns the biggest gaps first, dropping tribes that agree", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.9, levi: 0.5, reuben: 0.3 }),
      tableFrom({ judah: 0.2, levi: 0.5, reuben: 0.9 }),
    );
    const top = largestDivergences(rows, 2);
    expect(top.map((r) => r.slug)).toEqual(["judah", "reuben"]); // 0.7, then 0.6
    expect(top.every((r) => r.divergence > 0)).toBe(true);
  });

  it("omits tribes with no gap entirely", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.5 }),
      tableFrom({ judah: 0.5 }),
    );
    expect(largestDivergences(rows)).toEqual([]);
  });
});
