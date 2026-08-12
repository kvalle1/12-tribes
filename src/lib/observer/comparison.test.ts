import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles } from "./comparison";

/** Build a score table from slug→score overrides, defaulting others to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({ slug: t.slug, name: t.name, score: overrides[t.slug] ?? 0 }));

const rowFor = (slug: string, rows: ReturnType<typeof compareProfiles>) =>
  rows.find((r) => r.slug === slug)!;

describe("compareProfiles", () => {
  it("pairs self and others per tribe in canonical order", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.8 }),
      tableFrom({ judah: 0.4 }),
    );
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    const judah = rowFor("judah", rows);
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.4);
  });

  it("reports gap as self minus others (positive = you rate it higher than others)", () => {
    const rows = compareProfiles(
      tableFrom({ judah: 0.9, levi: 0.2 }),
      tableFrom({ judah: 0.3, levi: 0.7 }),
    );
    expect(rowFor("judah", rows).gap).toBeCloseTo(0.6);
    expect(rowFor("levi", rows).gap).toBeCloseTo(-0.5);
  });

  it("matches tribes by slug regardless of the others array's ordering", () => {
    const self = tableFrom({ judah: 0.5, levi: 0.5 });
    const othersReversed = [...tableFrom({ judah: 0.1, levi: 0.9 })].reverse();
    const rows = compareProfiles(self, othersReversed);
    expect(rowFor("judah", rows).others).toBeCloseTo(0.1);
    expect(rowFor("levi", rows).others).toBeCloseTo(0.9);
  });

  it("treats a tribe missing from the others profile as zero", () => {
    const rows = compareProfiles(tableFrom({ judah: 0.6 }), [
      { slug: "judah", name: "Judah", score: 0.6 },
    ]);
    // levi appears in self (as 0) but not in the sparse others array → others 0.
    expect(rowFor("levi", rows).others).toBe(0);
    expect(rowFor("judah", rows).gap).toBeCloseTo(0);
  });
});
