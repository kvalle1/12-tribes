import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles, comparisonScale } from "./compare";

/** Build a full 12-tribe score table, defaulting unlisted tribes to 0. */
const table = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({ slug: t.slug, name: t.name, score: overrides[t.slug] ?? 0 }));

const rowFor = (slug: string, rows: ReturnType<typeof compareProfiles>) =>
  rows.find((r) => r.slug === slug)!;

describe("compareProfiles", () => {
  it("pairs self and others per tribe and computes the gap (others − self)", () => {
    const self = table({ judah: 0.8, levi: 0.2 });
    const others = table({ judah: 0.5, levi: 0.6 });
    const rows = compareProfiles(self, others);

    expect(rows).toHaveLength(12);
    expect(rowFor("judah", rows).gap).toBeCloseTo(-0.3); // you claim it more
    expect(rowFor("levi", rows).gap).toBeCloseTo(0.4); // others see it more
  });

  it("sorts by the larger of the two scores, most salient first", () => {
    const self = table({ judah: 0.9, levi: 0.1 });
    const others = table({ asher: 0.7, levi: 0.1 });
    const rows = compareProfiles(self, others);
    // judah (self .9) leads, then asher (others .7); a tribe nobody scored trails.
    expect(rows[0].slug).toBe("judah");
    expect(rows[1].slug).toBe("asher");
    expect(rows[rows.length - 1].selfScore).toBe(0);
    expect(rows[rows.length - 1].othersScore).toBe(0);
  });

  it("defaults a tribe missing from the others profile to 0", () => {
    const self = table({ judah: 0.5 });
    const rows = compareProfiles(self, []);
    expect(rowFor("judah", rows).othersScore).toBe(0);
    expect(rowFor("judah", rows).gap).toBeCloseTo(-0.5);
  });

  it("does not mutate its inputs", () => {
    const self = table({ judah: 0.8 });
    const others = table({ levi: 0.4 });
    const selfCopy = self.map((s) => ({ ...s }));
    compareProfiles(self, others);
    expect(self).toEqual(selfCopy);
  });
});

describe("comparisonScale", () => {
  it("returns the largest bar value across both profiles", () => {
    const rows = compareProfiles(table({ judah: 0.8 }), table({ levi: 0.6 }));
    expect(comparisonScale(rows)).toBeCloseTo(0.8);
  });

  it("returns 0 when nothing scored", () => {
    expect(comparisonScale(compareProfiles(table({}), table({})))).toBe(0);
  });
});
