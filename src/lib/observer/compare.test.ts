import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles } from "./compare";

/** Build a canonical-order score vector from a {slug: score} map (others 0). */
const vector = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const first = tribes[0].slug;
const second = tribes[1].slug;
const third = tribes[2].slug;

describe("compareProfiles", () => {
  it("pairs each tribe's self and other score into one row", () => {
    const rows = compareProfiles(
      vector({ [first]: 0.8 }),
      vector({ [first]: 0.3 }),
    );
    const row = rows.find((r) => r.slug === first)!;
    expect(row.self).toBe(0.8);
    expect(row.other).toBe(0.3);
    expect(row.name).toBe(tribes[0].name);
  });

  it("returns exactly one row per tribe", () => {
    const rows = compareProfiles(vector({}), vector({}));
    expect(rows).toHaveLength(tribes.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(tribes.length);
  });

  it("measures divergence as the absolute gap between self and other", () => {
    const rows = compareProfiles(
      vector({ [first]: 0.9, [second]: 0.4 }),
      vector({ [first]: 0.2, [second]: 0.4 }),
    );
    expect(rows.find((r) => r.slug === first)!.divergence).toBeCloseTo(0.7, 10);
    expect(rows.find((r) => r.slug === second)!.divergence).toBeCloseTo(0, 10);
  });

  it("ranks rows by the stronger of the two scores, highest first", () => {
    const rows = compareProfiles(
      vector({ [first]: 0.1, [second]: 0.2, [third]: 0.9 }),
      vector({ [first]: 0.5, [second]: 0.2, [third]: 0.1 }),
    );
    // third leads on self (0.9); first leads on other (0.5); second trails both.
    expect(rows.map((r) => r.slug).slice(0, 3)).toEqual([third, first, second]);
  });

  it("keeps canonical order for rows that tie on their stronger score", () => {
    const rows = compareProfiles(vector({}), vector({}));
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });
});
