import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import {
  compareProfiles,
  AGREEMENT_THRESHOLD,
  type ComparisonRow,
  DIVERGENCE_THRESHOLD,
} from "./compare";

/** Build a canonical-order score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, rows: ComparisonRow[]) =>
  rows.find((r) => r.slug === slug)!;

describe("compareProfiles", () => {
  it("pairs every tribe with both reads and the signed others-minus-self gap", () => {
    const comparison = compareProfiles(
      tableFrom({ judah: 0.8 }),
      tableFrom({ judah: 0.4 }),
    );
    expect(comparison.rows).toHaveLength(12);
    const judah = rowFor("judah", comparison.rows);
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.4);
    expect(judah.gap).toBeCloseTo(-0.4); // others see it less strongly than self
  });

  it("matches tribes by slug regardless of input ordering", () => {
    const self = tableFrom({ levi: 0.5 });
    const others = [...tableFrom({ levi: 0.9 })].reverse();
    const levi = rowFor("levi", compareProfiles(self, others).rows);
    expect(levi.self).toBeCloseTo(0.5);
    expect(levi.others).toBeCloseTo(0.9);
    expect(levi.gap).toBeCloseTo(0.4);
  });

  it("ranks rows by the stronger of the two reads, canonical tie-break", () => {
    const comparison = compareProfiles(
      tableFrom({ judah: 0.2, levi: 0.9 }),
      tableFrom({ judah: 0.95, levi: 0.1 }),
    );
    // judah's stronger read (0.95) tops levi's (0.9).
    expect(comparison.rows[0].slug).toBe("judah");
    expect(comparison.rows[1].slug).toBe("levi");
  });

  it("holds canonical order for tribes with equal strength", () => {
    // judah (#1) and benjamin (#6) both peak at 0.5 → canonical order wins.
    const comparison = compareProfiles(
      tableFrom({ judah: 0.5, benjamin: 0.5 }),
      tableFrom({ judah: 0.5, benjamin: 0.5 }),
    );
    const judahIdx = comparison.rows.findIndex((r) => r.slug === "judah");
    const benjaminIdx = comparison.rows.findIndex((r) => r.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("draws both bars on a shared scale with the peak read filling the bar", () => {
    const comparison = compareProfiles(
      tableFrom({ judah: 0.6 }),
      tableFrom({ levi: 0.3 }),
    );
    // Shared peak is self judah = 0.6 → it fills the bar; others-levi 0.3 is half.
    expect(rowFor("judah", comparison.rows).selfRelative).toBeCloseTo(1);
    expect(rowFor("levi", comparison.rows).othersRelative).toBeCloseTo(0.5);
    for (const r of comparison.rows) {
      expect(r.selfRelative).toBeGreaterThanOrEqual(0);
      expect(r.selfRelative).toBeLessThanOrEqual(1);
      expect(r.othersRelative).toBeGreaterThanOrEqual(0);
      expect(r.othersRelative).toBeLessThanOrEqual(1);
    }
  });

  it("flags a tribe as divergent when the gap clears the threshold of the peak", () => {
    // Peak is 1.0; a gap of 0.5 is half the peak, well over the 0.33 threshold.
    const comparison = compareProfiles(
      tableFrom({ judah: 1.0, levi: 0.5 }),
      tableFrom({ judah: 1.0, levi: 0.0 }),
    );
    expect(rowFor("levi", comparison.rows).divergent).toBe(true);
    // judah agrees exactly → never divergent.
    expect(rowFor("judah", comparison.rows).divergent).toBe(false);
  });

  it("does not flag small gaps as divergent", () => {
    // Peak 1.0; gap 0.1 is below the 0.33 threshold.
    const comparison = compareProfiles(
      tableFrom({ judah: 1.0, levi: 0.5 }),
      tableFrom({ judah: 1.0, levi: 0.4 }),
    );
    expect(rowFor("levi", comparison.rows).divergent).toBe(false);
  });

  it("names the highest shared floor as the strongest agreement", () => {
    const comparison = compareProfiles(
      tableFrom({ judah: 0.9, levi: 0.6 }),
      tableFrom({ judah: 0.8, levi: 0.7 }),
    );
    // judah shared floor min(0.9,0.8)=0.8 beats levi min(0.6,0.7)=0.6.
    expect(comparison.topAgreement?.slug).toBe("judah");
  });

  it("names the largest gap as the sharpest divergence", () => {
    const comparison = compareProfiles(
      tableFrom({ judah: 1.0, dan: 0.0, levi: 0.5 }),
      tableFrom({ judah: 0.9, dan: 0.8, levi: 0.1 }),
    );
    // dan gap = +0.8 is the largest absolute gap.
    expect(comparison.topDivergence?.slug).toBe("dan");
  });

  it("does not call a faintly-shared tribe an agreement", () => {
    // Both reads peak elsewhere (self judah, others dan at the shared max 1.0);
    // levi is shared but tiny (0.05), far below AGREEMENT_THRESHOLD of the peak.
    const comparison = compareProfiles(
      tableFrom({ judah: 1.0, levi: 0.05 }),
      tableFrom({ dan: 1.0, levi: 0.05 }),
    );
    expect(comparison.topAgreement).toBeUndefined();
  });

  it("reports no agreement or divergence for two empty profiles", () => {
    const comparison = compareProfiles(tableFrom({}), tableFrom({}));
    expect(comparison.topAgreement).toBeUndefined();
    expect(comparison.topDivergence).toBeUndefined();
    expect(comparison.rows.every((r) => !r.divergent)).toBe(true);
    expect(comparison.rows.every((r) => r.selfRelative === 0)).toBe(true);
  });

  it("exposes tunable agreement and divergence thresholds", () => {
    expect(DIVERGENCE_THRESHOLD).toBeGreaterThan(0);
    expect(DIVERGENCE_THRESHOLD).toBeLessThan(1);
    expect(AGREEMENT_THRESHOLD).toBeGreaterThan(0);
    expect(AGREEMENT_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
