import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankTribes, resolveHeadline } from "./result";

/**
 * `rankTribes` is the pure helper behind the result page's 12-tribe ranking bars
 * (issue #6). It takes the scores the (server-only) scoring core produced and
 * resolves them into full `Tribe` objects, sorted best-first, with the Primary
 * and Secondary flagged. Keeping it pure and client-safe (no DB, no word→tribe
 * mapping) lets the result page and the profile page share it and lets us test
 * its behavior without the scoring internals.
 */

/** Build a TribeScore[] in canonical order, overriding scores by slug. */
function scoresOf(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));
}

describe("rankTribes", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankTribes(scoresOf({}), "judah");
    expect(ranked).toHaveLength(tribes.length);
    expect(new Set(ranked.map((r) => r.tribe.slug)).size).toBe(tribes.length);
  });

  it("sorts by score descending", () => {
    const ranked = rankTribes(
      scoresOf({ judah: 0.2, levi: 0.9, dan: 0.5 }),
      "levi",
    );
    const sorted = [...ranked].sort((a, b) => b.score - a.score);
    expect(ranked.map((r) => r.tribe.slug)).toEqual(
      sorted.map((r) => r.tribe.slug),
    );
    expect(ranked[0].tribe.slug).toBe("levi");
  });

  it("resolves each score to its full Tribe object and 0–1 score", () => {
    const ranked = rankTribes(scoresOf({ judah: 0.5 }), "judah");
    const judah = ranked.find((r) => r.tribe.slug === "judah")!;
    expect(judah.tribe.name).toBe("Judah");
    expect(judah.tribe.color).toBe("amber");
    expect(judah.score).toBe(0.5);
  });

  it("flags the Primary and Secondary roles and leaves the rest null", () => {
    const ranked = rankTribes(
      scoresOf({ judah: 0.9, levi: 0.8, dan: 0.3 }),
      "judah",
      "levi",
    );
    const role = (slug: string) =>
      ranked.find((r) => r.tribe.slug === slug)!.role;
    expect(role("judah")).toBe("primary");
    expect(role("levi")).toBe("secondary");
    expect(role("dan")).toBeNull();
    expect(ranked.filter((r) => r.role === "primary")).toHaveLength(1);
    expect(ranked.filter((r) => r.role === "secondary")).toHaveLength(1);
  });

  it("marks no Secondary when none was passed", () => {
    const ranked = rankTribes(scoresOf({ judah: 0.9 }), "judah");
    expect(ranked.some((r) => r.role === "secondary")).toBe(false);
  });

  it("breaks score ties in canonical tribe order", () => {
    // Judah (#1) and Levi (#2) tie; Judah must come first.
    const ranked = rankTribes(scoresOf({ judah: 0.5, levi: 0.5 }), "judah");
    const judahIdx = ranked.findIndex((r) => r.tribe.slug === "judah");
    const leviIdx = ranked.findIndex((r) => r.tribe.slug === "levi");
    expect(judahIdx).toBeLessThan(leviIdx);
  });

  it("throws on an unknown primary slug (guards against drift)", () => {
    expect(() => rankTribes(scoresOf({}), "nope")).toThrow();
  });
});

describe("resolveHeadline", () => {
  it("resolves a primary-only result", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.name).toBe("Judah");
    expect(secondary).toBeUndefined();
  });
});
