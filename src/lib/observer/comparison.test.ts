import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles, divergences } from "./comparison";

const table = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({ slug: t.slug, name: t.name, score: overrides[t.slug] ?? 0 }));

describe("compareProfiles", () => {
  it("returns one row per tribe in canonical order", () => {
    const rows = compareProfiles(table({ judah: 0.8 }), table({ judah: 0.4 }));
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("pairs self and others by tribe and sets delta = self - others", () => {
    const rows = compareProfiles(
      table({ judah: 0.8, levi: 0.2 }),
      table({ judah: 0.5, levi: 0.6 }),
    );
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.5);
    expect(judah.delta).toBeCloseTo(0.3);

    const levi = rows.find((r) => r.slug === "levi")!;
    expect(levi.delta).toBeCloseTo(-0.4);
  });

  it("matches tribes by slug even if the inputs are ordered differently", () => {
    const self = table({ judah: 0.9 });
    const others = [...table({ judah: 0.3 })].reverse();
    const judah = compareProfiles(self, others).find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(0.9);
    expect(judah.others).toBeCloseTo(0.3);
  });
});

describe("divergences", () => {
  it("orders tribes by the size of the self/others gap, largest first", () => {
    const rows = compareProfiles(
      table({ judah: 0.9, levi: 0.5, reuben: 0.4 }),
      table({ judah: 0.2, levi: 0.5, reuben: 0.45 }),
    );
    const d = divergences(rows);
    expect(d[0].slug).toBe("judah"); // gap 0.7, the widest
  });

  it("omits tribes where self and others agree (zero gap)", () => {
    const rows = compareProfiles(table({ levi: 0.5 }), table({ levi: 0.5 }));
    expect(divergences(rows)).toHaveLength(0);
  });

  it("marks who rates the tribe higher", () => {
    const rows = compareProfiles(
      table({ judah: 0.9, dan: 0.1 }),
      table({ judah: 0.2, dan: 0.8 }),
    );
    const d = divergences(rows);
    const judah = d.find((r) => r.slug === "judah")!;
    const dan = d.find((r) => r.slug === "dan")!;
    expect(judah.direction).toBe("self-higher");
    expect(dan.direction).toBe("others-higher");
  });

  it("limits to the requested number of highlights", () => {
    const rows = compareProfiles(
      table({ judah: 0.9, levi: 0.7, reuben: 0.5, dan: 0.3 }),
      table({ judah: 0.1, levi: 0.1, reuben: 0.1, dan: 0.1 }),
    );
    expect(divergences(rows, 2)).toHaveLength(2);
  });
});
