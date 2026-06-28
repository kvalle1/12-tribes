import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { buildRanking, resolveHeadline } from "./result";

/**
 * `buildRanking` is the pure, client-safe shaping behind the result page's
 * 12-tribe ranking bars (#6): it sorts the scored tribes, flags the
 * Primary/Secondary, and computes each bar's proportional fill. Tested through
 * its public interface — given scores in, what ranked rows come out.
 */

/** Build a full 12-entry score set (canonical tribe order) from a slug→score map. */
function scoresFor(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));
}

describe("buildRanking", () => {
  it("returns one row per tribe, sorted by score descending", () => {
    const ranked = buildRanking(
      scoresFor({ judah: 0.4, levi: 0.9, dan: 0.6 }),
      "levi",
    );

    expect(ranked).toHaveLength(tribes.length);
    const sorted = ranked.map((r) => r.score);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
    expect(ranked[0].slug).toBe("levi");
    expect(ranked[1].slug).toBe("dan");
    expect(ranked[2].slug).toBe("judah");
  });

  it("flags the Primary and Secondary", () => {
    const ranked = buildRanking(
      scoresFor({ levi: 0.9, dan: 0.6, judah: 0.4 }),
      "levi",
      "dan",
    );
    const primary = ranked.find((r) => r.isPrimary);
    const secondary = ranked.find((r) => r.isSecondary);

    expect(primary?.slug).toBe("levi");
    expect(secondary?.slug).toBe("dan");
    expect(ranked.filter((r) => r.isPrimary)).toHaveLength(1);
    expect(ranked.filter((r) => r.isSecondary)).toHaveLength(1);
  });

  it("has no Secondary flag when none is given", () => {
    const ranked = buildRanking(scoresFor({ levi: 0.9, dan: 0.6 }), "levi");
    expect(ranked.some((r) => r.isSecondary)).toBe(false);
  });

  it("computes bar fill proportional to score, with the top tribe full", () => {
    const ranked = buildRanking(
      scoresFor({ levi: 0.8, dan: 0.4, judah: 0.2 }),
      "levi",
    );
    const bySlug = Object.fromEntries(ranked.map((r) => [r.slug, r]));

    expect(bySlug.levi.fraction).toBeCloseTo(1);
    expect(bySlug.dan.fraction).toBeCloseTo(0.5);
    expect(bySlug.judah.fraction).toBeCloseTo(0.25);
  });

  it("yields zero fill for every tribe when all scores are zero", () => {
    const ranked = buildRanking(scoresFor({}), "judah");
    expect(ranked.every((r) => r.fraction === 0)).toBe(true);
  });

  it("clamps the bar fill at zero, never negative", () => {
    // Defensive: scoring never emits negatives today, but the 0–1 contract holds
    // even if a future change did.
    const scores = scoresFor({ levi: 0.6 });
    scores.find((s) => s.slug === "judah")!.score = -0.3;
    const ranked = buildRanking(scores, "levi");
    expect(ranked.every((r) => r.fraction >= 0)).toBe(true);
  });

  it("breaks score ties in canonical tribe order", () => {
    // Judah (#1) and Levi (#2) tie; canonical order puts Judah first.
    const ranked = buildRanking(scoresFor({ judah: 0.5, levi: 0.5 }), "judah");
    const judahIdx = ranked.findIndex((r) => r.slug === "judah");
    const leviIdx = ranked.findIndex((r) => r.slug === "levi");
    expect(judahIdx).toBeLessThan(leviIdx);
  });

  it("carries each tribe's accent color for the bar", () => {
    const ranked = buildRanking(scoresFor({ judah: 0.5 }), "judah");
    const judah = ranked.find((r) => r.slug === "judah");
    expect(judah?.color).toBe("amber");
  });
});

describe("resolveHeadline", () => {
  it("resolves primary and optional secondary slugs to full tribes", () => {
    const { primary, secondary } = resolveHeadline("judah", "levi");
    expect(primary.name).toBe("Judah");
    expect(secondary?.name).toBe("Levi");
  });

  it("omits the secondary when not provided", () => {
    const { secondary } = resolveHeadline("judah", null);
    expect(secondary).toBeUndefined();
  });
});
