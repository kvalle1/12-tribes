import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankTribes, resolveHeadline } from "./result";

/**
 * `rankTribes` is the pure, client-safe view-model the enriched result page
 * (#6) renders its 12-tribe bars from. It takes already-computed normalized
 * scores (so it never imports the server-only word→tribe mapping) and returns
 * every tribe ordered by score, tagged with which is Primary / Secondary.
 */

/** Build a full 12-entry TribeScore[] in canonical order, overriding some scores. */
function scoresFor(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));
}

describe("rankTribes", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankTribes(scoresFor({}), tribes[0].slug);
    expect(ranked).toHaveLength(tribes.length);
  });

  it("orders tribes by descending score", () => {
    const ranked = rankTribes(
      scoresFor({ levi: 0.4, judah: 0.9, dan: 0.6 }),
      "judah",
    );
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked[0].tribe.slug).toBe("judah");
    expect(ranked[1].tribe.slug).toBe("dan");
    expect(ranked[2].tribe.slug).toBe("levi");
  });

  it("breaks ties by canonical (tribe number) order", () => {
    // Judah (#1) and Levi (#2) tie; Judah must come first.
    const ranked = rankTribes(scoresFor({ judah: 0.5, levi: 0.5 }), "judah");
    const judahIdx = ranked.findIndex((r) => r.tribe.slug === "judah");
    const leviIdx = ranked.findIndex((r) => r.tribe.slug === "levi");
    expect(judahIdx).toBeLessThan(leviIdx);
  });

  it("flags the Primary and Secondary tribes, and nothing else", () => {
    const ranked = rankTribes(
      scoresFor({ judah: 0.9, levi: 0.7, dan: 0.2 }),
      "judah",
      "levi",
    );
    const primary = ranked.filter((r) => r.isPrimary);
    const secondary = ranked.filter((r) => r.isSecondary);
    expect(primary.map((r) => r.tribe.slug)).toEqual(["judah"]);
    expect(secondary.map((r) => r.tribe.slug)).toEqual(["levi"]);
  });

  it("marks no Secondary when none is given", () => {
    const ranked = rankTribes(scoresFor({ judah: 0.9 }), "judah", null);
    expect(ranked.some((r) => r.isSecondary)).toBe(false);
    expect(ranked.filter((r) => r.isPrimary)).toHaveLength(1);
  });

  it("attaches the full Tribe object for rendering", () => {
    const ranked = rankTribes(scoresFor({ judah: 0.9 }), "judah");
    const judah = ranked.find((r) => r.tribe.slug === "judah");
    expect(judah?.tribe.callSign).toBe("The Lion");
    expect(judah?.tribe.color).toBe("amber");
  });

  it("throws on a score referencing an unknown tribe slug", () => {
    const bad: TribeScore[] = [{ slug: "nope", name: "Nope", score: 1 }];
    expect(() => rankTribes(bad, "nope")).toThrow(/unknown tribe slug/i);
  });
});

describe("resolveHeadline", () => {
  it("resolves primary and secondary slugs to Tribe objects", () => {
    const { primary, secondary } = resolveHeadline("judah", "levi");
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("levi");
  });

  it("omits secondary when not provided", () => {
    const { secondary } = resolveHeadline("judah", null);
    expect(secondary).toBeUndefined();
  });
});
