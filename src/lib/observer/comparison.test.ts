import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles } from "./comparison";

/** Build a full 12-tribe score table, defaulting unspecified tribes to 0. */
const table = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug);

describe("compareProfiles", () => {
  it("never lists the same tribe as both aligned and diverging", () => {
    // Total disagreement on few tribes: you read only Judah, observers only Dan.
    // The old smallest-gap alignment would have shown both tribes as "aligned"
    // AND "diverging" — this is the blocker that must not recur.
    const self = table({ judah: 0.63 });
    const others = table({ dan: 0.625 });

    const { alignments, divergences } = compareProfiles(self, others);

    expect(alignments).toHaveLength(0);
    expect(slugs(divergences)).toEqual(expect.arrayContaining(["judah", "dan"]));

    const overlap = alignments.filter((a) =>
      divergences.some((d) => d.slug === a.slug),
    );
    expect(overlap).toHaveLength(0);
  });

  it("counts a tribe both sides read about equally as alignment, not divergence", () => {
    const self = table({ judah: 0.6, levi: 0.1 });
    const others = table({ judah: 0.58, levi: 0.09 });

    const { alignments, divergences } = compareProfiles(self, others);

    expect(slugs(alignments)).toContain("judah");
    expect(slugs(divergences)).not.toContain("judah");
  });

  it("requires both sides to read a tribe before calling it aligned", () => {
    // Judah dominates the scale; Benjamin has a tiny gap but only the Subject
    // reads it, so a naive "small gap ⇒ aligned" rule would wrongly include it.
    const self = table({ judah: 1.0, benjamin: 0.05 });
    const others = table({ judah: 0.95, benjamin: 0 });

    const { alignments } = compareProfiles(self, others);

    expect(slugs(alignments)).toContain("judah");
    expect(slugs(alignments)).not.toContain("benjamin");
  });

  it("returns all twelve tribes strongest-first with the shared display scale", () => {
    const self = table({ judah: 0.6, levi: 0.3, dan: 0.1 });
    const others = table({ judah: 0.2, levi: 0.3, gad: 0.5 });

    const { rows, scale } = compareProfiles(self, others);

    expect(rows).toHaveLength(tribes.length);
    expect(scale).toBeCloseTo(0.6, 12);
    for (let i = 1; i < rows.length; i++) {
      const prev = Math.max(rows[i - 1].self, rows[i - 1].others);
      const cur = Math.max(rows[i].self, rows[i].others);
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("reports gap as self − others so the direction of divergence is readable", () => {
    const self = table({ judah: 0.7, gad: 0.1 });
    const others = table({ judah: 0.2, gad: 0.6 });

    const { rows } = compareProfiles(self, others);
    const judah = rows.find((r) => r.slug === "judah")!;
    const gad = rows.find((r) => r.slug === "gad")!;

    expect(judah.gap).toBeGreaterThan(0); // you see more Judah than others do
    expect(gad.gap).toBeLessThan(0); // others see more Gad in you than you do
  });
});
