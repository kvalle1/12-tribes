import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { compareProfiles, topDivergences } from "./comparison";

/** Build a canonical-order profile from a slug→score map (others default to 0). */
const profile = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("compareProfiles", () => {
  it("joins self and others by slug into one row per tribe", () => {
    const rows = compareProfiles(
      profile({ judah: 0.8, asher: 0.2 }),
      profile({ judah: 0.4, asher: 0.5 }),
    );
    expect(rows).toHaveLength(12);
    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(0.8);
    expect(judah.others).toBeCloseTo(0.4);
    expect(judah.delta).toBeCloseTo(-0.4);

    const asher = rows.find((r) => r.slug === "asher")!;
    expect(asher.delta).toBeCloseTo(0.3); // others see it more strongly
  });

  it("orders rows by the Subject's own score, highest first", () => {
    const rows = compareProfiles(
      profile({ asher: 0.9, judah: 0.5, dan: 0.1 }),
      profile({}),
    );
    expect(rows[0].slug).toBe("asher");
    expect(rows[1].slug).toBe("judah");
    expect(rows[2].slug).toBe("dan");
  });

  it("keeps canonical order as a stable tie-break when self scores are equal", () => {
    const rows = compareProfiles(profile({}), profile({ dan: 0.5 }));
    // All self scores are 0, so order must fall back to canonical tribe order.
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("treats a tribe missing from the others profile as zero", () => {
    const others: TribeScore[] = [
      { slug: "judah", name: "Judah", score: 0.6 },
    ];
    const rows = compareProfiles(profile({ judah: 0.4, asher: 0.3 }), others);
    const asher = rows.find((r) => r.slug === "asher")!;
    expect(asher.others).toBe(0);
    expect(asher.delta).toBeCloseTo(-0.3);
  });
});

describe("topDivergences", () => {
  it("returns the largest gaps first, by absolute delta", () => {
    const rows = compareProfiles(
      profile({ judah: 0.8, asher: 0.2, dan: 0.5 }),
      profile({ judah: 0.4, asher: 0.9, dan: 0.5 }),
    );
    const top = topDivergences(rows, 2);
    expect(top).toHaveLength(2);
    expect(top[0].slug).toBe("asher"); // |0.7| gap
    expect(top[1].slug).toBe("judah"); // |0.4| gap
  });

  it("excludes perfectly-aligned tribes and returns nothing when all align", () => {
    const rows = compareProfiles(
      profile({ judah: 0.5, asher: 0.3 }),
      profile({ judah: 0.5, asher: 0.3 }),
    );
    expect(topDivergences(rows)).toEqual([]);
  });

  it("respects the limit", () => {
    const rows = compareProfiles(
      profile({ judah: 0.9, asher: 0.8, dan: 0.7, levi: 0.6 }),
      profile({}),
    );
    expect(topDivergences(rows, 3)).toHaveLength(3);
  });
});
