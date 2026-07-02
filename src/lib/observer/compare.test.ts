import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import {
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./compare";

/** Build a canonical-order score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("isReportUnlocked", () => {
  it("stays locked below the observer threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK - 1)).toBe(false);
  });

  it("unlocks at and above the threshold", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK + 5)).toBe(true);
  });

  it("unlocks at exactly three, matching ADR-0003", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });
});

describe("compareProfiles", () => {
  it("returns one row per tribe carrying both self and others scores", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.8 }),
      tableFrom({ judah: 0.4 }),
    );
    expect(rows).toHaveLength(12);
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.4);
  });

  it("computes the gap as others minus self (positive = others see it more)", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.3, levi: 0.9 }),
      tableFrom({ judah: 0.7, levi: 0.2 }),
    );
    const judah = rows.find((r) => r.slug === "judah")!;
    const levi = rows.find((r) => r.slug === "levi")!;
    expect(judah.gap).toBeCloseTo(0.4); // others see more Judah
    expect(levi.gap).toBeCloseTo(-0.7); // subject sees more Levi than others do
  });

  it("ranks rows by combined prominence (self + others), highest first", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.2, levi: 0.9, reuben: 0.5 }),
      tableFrom({ judah: 0.9, levi: 0.1, reuben: 0.5 }),
    );
    // Combined prominence: judah 0.2+0.9=1.1, levi 0.9+0.1=1.0, reuben
    // 0.5+0.5=1.0 → judah ranks first.
    expect(rows[0].slug).toBe("judah");
  });

  it("scales bar fractions relative to the single largest score across both profiles", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.5 }),
      tableFrom({ judah: 1.0, levi: 0.5 }),
    );
    const judah = rows.find((r) => r.slug === "judah")!;
    const levi = rows.find((r) => r.slug === "levi")!;
    // Global max is others.judah = 1.0.
    expect(judah.othersRelative).toBeCloseTo(1);
    expect(judah.selfRelative).toBeCloseTo(0.5);
    expect(levi.othersRelative).toBeCloseTo(0.5);
    expect(levi.selfRelative).toBeCloseTo(0);
  });

  it("keeps bar fractions at zero when nothing scored (no divide-by-zero)", () => {
    const rows = compareProfiles(tableFrom({}), tableFrom({}));
    expect(rows.every((r) => r.selfRelative === 0 && r.othersRelative === 0)).toBe(
      true,
    );
  });
});
