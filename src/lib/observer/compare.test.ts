import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles } from "./compare";

/** Build a full 12-tribe score table, defaulting unlisted tribes to 0. */
const table = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rowFor = (slug: string, rows: { slug: string }[]) =>
  rows.find((r) => r.slug === slug)!;

describe("compareProfiles", () => {
  it("pairs self and others per tribe with a signed others-minus-self delta", () => {
    const cmp = compareProfiles(
      table({ judah: 0.8, levi: 0.2 }),
      table({ judah: 0.5, levi: 0.6 }),
    );
    const judah = rowFor("judah", cmp.tribes);
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.5);
    expect(judah.delta).toBeCloseTo(-0.3); // others see it less than self does

    const levi = rowFor("levi", cmp.tribes);
    expect(levi.delta).toBeCloseTo(0.4); // others see it more than self does
  });

  it("orders rows by the Subject's own score, highest first", () => {
    const cmp = compareProfiles(
      table({ levi: 0.2, judah: 0.9, reuben: 0.5 }),
      table({}),
    );
    expect(cmp.tribes.map((t) => t.slug).slice(0, 3)).toEqual([
      "judah",
      "reuben",
      "levi",
    ]);
  });

  it("matches others to self by slug even if the arrays are ordered differently", () => {
    const self = table({ judah: 0.7 });
    const others = [...table({ judah: 0.3 })].reverse();
    const cmp = compareProfiles(self, others);
    expect(rowFor("judah", cmp.tribes).others).toBeCloseTo(0.3);
  });

  it("names the smallest-gap tribe (with signal) as strongest agreement", () => {
    const cmp = compareProfiles(
      table({ judah: 0.8, levi: 0.4 }),
      table({ judah: 0.78, levi: 0.9 }),
    );
    expect(cmp.strongestAgreement?.slug).toBe("judah"); // gap 0.02 vs 0.50
  });

  it("names the largest-gap tribe as the divergence", () => {
    const cmp = compareProfiles(
      table({ judah: 0.8, levi: 0.4 }),
      table({ judah: 0.78, levi: 0.9 }),
    );
    expect(cmp.largestDivergence?.slug).toBe("levi");
  });

  it("ignores all-zero tribes when picking agreement (no false 'perfect match')", () => {
    // Every unscored tribe has self=others=0 (gap 0). Those must not win
    // 'strongest agreement' over a tribe both sides actually scored.
    const cmp = compareProfiles(
      table({ judah: 0.5 }),
      table({ judah: 0.5 }),
    );
    expect(cmp.strongestAgreement?.slug).toBe("judah");
  });

  it("reports no divergence when self and others are identical", () => {
    const cmp = compareProfiles(
      table({ judah: 0.5, levi: 0.3 }),
      table({ judah: 0.5, levi: 0.3 }),
    );
    expect(cmp.largestDivergence).toBeNull();
  });

  it("returns null agreement/divergence when neither side scored anything", () => {
    const cmp = compareProfiles(table({}), table({}));
    expect(cmp.strongestAgreement).toBeNull();
    expect(cmp.largestDivergence).toBeNull();
    expect(cmp.tribes).toHaveLength(12);
  });
});
