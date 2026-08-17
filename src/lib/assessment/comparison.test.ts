import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { buildComparison, comparisonHighlights } from "./comparison";

/** Build a full 12-tribe score table from a slug→score override map. */
const table = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("buildComparison", () => {
  it("pairs the self and others score for every tribe", () => {
    const rows = buildComparison(
      table({ judah: 0.8 }),
      table({ judah: 0.4 }),
    );
    expect(rows).toHaveLength(12);
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBe(0.8);
    expect(judah.others).toBe(0.4);
    expect(judah.gap).toBeCloseTo(-0.4, 10); // others - self
  });

  it("orders rows by the stronger of the two reads, canonical tie-break", () => {
    const rows = buildComparison(
      table({ asher: 0.1, judah: 0.9 }),
      table({ asher: 0.7, judah: 0.2 }),
    );
    // judah leads on self (0.9); asher leads on others (0.7); judah's 0.9 is the
    // single largest value across both sides, so judah comes first.
    expect(rows[0].slug).toBe("judah");
    expect(rows[1].slug).toBe("asher");
  });

  it("scales both bars against one shared maximum so they are comparable", () => {
    const rows = buildComparison(
      table({ judah: 0.5 }),
      table({ asher: 1.0 }),
    );
    const judah = rows.find((r) => r.slug === "judah")!;
    const asher = rows.find((r) => r.slug === "asher")!;
    // Shared max is 1.0 (asher/others), so judah's self bar fills half.
    expect(asher.othersRelative).toBeCloseTo(1, 10);
    expect(judah.selfRelative).toBeCloseTo(0.5, 10);
  });

  it("keeps relative fills at zero when every score is zero", () => {
    const rows = buildComparison(table({}), table({}));
    expect(rows.every((r) => r.selfRelative === 0 && r.othersRelative === 0)).toBe(
      true,
    );
  });
});

describe("comparisonHighlights", () => {
  it("names the biggest blind spot where others see more than you do", () => {
    const rows = buildComparison(
      table({ judah: 0.9, asher: 0.1 }),
      table({ judah: 0.8, asher: 0.9 }),
    );
    const h = comparisonHighlights(rows);
    // asher: others 0.9 vs self 0.1 — the largest positive gap.
    expect(h.biggestBlindSpot?.slug).toBe("asher");
  });

  it("names the biggest overestimate where you see more than others do", () => {
    const rows = buildComparison(
      table({ judah: 0.9, asher: 0.2 }),
      table({ judah: 0.2, asher: 0.2 }),
    );
    const h = comparisonHighlights(rows);
    // judah: self 0.9 vs others 0.2 — the largest negative gap.
    expect(h.biggestOverestimate?.slug).toBe("judah");
  });

  it("names the strongest agreement among tribes both reads rate highly", () => {
    const rows = buildComparison(
      table({ judah: 0.85, asher: 0.3 }),
      table({ judah: 0.8, asher: 0.32 }),
    );
    const h = comparisonHighlights(rows);
    expect(h.strongestAgreement?.slug).toBe("judah");
  });

  it("returns null highlights when there is no signal at all", () => {
    const rows = buildComparison(table({}), table({}));
    const h = comparisonHighlights(rows);
    expect(h.biggestBlindSpot).toBeNull();
    expect(h.biggestOverestimate).toBeNull();
    expect(h.strongestAgreement).toBeNull();
  });
});
