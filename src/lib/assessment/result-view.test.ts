import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { buildResultView } from "./result-view";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

// A realistic Levi-dominant selection: all of Levi's words plus a couple of
// Judah-flavoured ones, so the ranking has a clear leader and a runner-up.
const leviWords = [...wordsForTribe("levi"), "Courageous", "Bold"];
const { primary: leviPrimary, secondary: leviSecondary } = (() => {
  // Mirror what the repository would persist for this selection.
  const ranked = [...score(leviWords)].sort((a, b) => b.score - a.score);
  return { primary: ranked[0].slug, secondary: ranked[1].slug };
})();

describe("buildResultView", () => {
  it("ranks all 12 tribes by descending normalized score", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    expect(view.ranked).toHaveLength(12);
    const slugs = view.ranked.map((r) => r.tribe.slug);
    expect(new Set(slugs).size).toBe(12);
    for (let i = 1; i < view.ranked.length; i++) {
      expect(view.ranked[i - 1].score).toBeGreaterThanOrEqual(
        view.ranked[i].score,
      );
    }
  });

  it("resolves the primary (and secondary) tribe objects from the stored slugs", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    expect(view.primary.slug).toBe(leviPrimary);
    expect(view.secondary?.slug).toBe(leviSecondary);
    expect(view.ranked[0].tribe.slug).toBe(leviPrimary);
  });

  it("returns no secondary when none was stored", () => {
    const view = buildResultView(["Courageous"], "judah", null);
    expect(view.secondary).toBeUndefined();
    expect(view.ranked.filter((r) => r.isSecondary)).toHaveLength(0);
  });

  it("flags exactly the stored primary and secondary in the ranking", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    const primaries = view.ranked.filter((r) => r.isPrimary);
    const secondaries = view.ranked.filter((r) => r.isSecondary);
    expect(primaries.map((r) => r.tribe.slug)).toEqual([leviPrimary]);
    expect(secondaries.map((r) => r.tribe.slug)).toEqual([leviSecondary]);
  });

  it("gives the leader a full-width bar and others a proportional fraction", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    const top = view.ranked[0];
    expect(top.barFraction).toBeCloseTo(1);
    for (const r of view.ranked) {
      expect(r.barFraction).toBeGreaterThanOrEqual(0);
      expect(r.barFraction).toBeLessThanOrEqual(1);
      // barFraction is each tribe's score relative to the leader's.
      expect(r.barFraction).toBeCloseTo(r.score / top.score);
    }
  });

  it("exposes a 0–100 integer percent matching the normalized score", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    for (const r of view.ranked) {
      expect(r.percent).toBe(Math.round(r.score * 100));
      expect(Number.isInteger(r.percent)).toBe(true);
    }
  });

  it("echoes the subject's selected words unchanged", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    expect(view.words).toEqual(leviWords);
  });

  it("attaches a per-tribe accent hex for every ranked tribe", () => {
    const view = buildResultView(leviWords, leviPrimary, leviSecondary);
    for (const r of view.ranked) {
      expect(r.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("does not divide by zero when nothing scored", () => {
    // Defensive: a saved result always has words, but the leader's score could
    // theoretically be 0; bar fractions must stay finite.
    const view = buildResultView([], "judah", null);
    for (const r of view.ranked) {
      expect(Number.isFinite(r.barFraction)).toBe(true);
      expect(r.barFraction).toBe(0);
    }
  });

  it("throws on an unknown primary slug (a corrupt stored result)", () => {
    expect(() => buildResultView(["Courageous"], "nope", null)).toThrow();
  });

  it("keeps the canonical tribe order for ties (deterministic ranking)", () => {
    // Two single-tribe words for tribes that share no words → equal-ish but
    // distinct; ensure stable ordering by re-running and comparing.
    const a = buildResultView(["Courageous"], "judah", null).ranked.map(
      (r) => r.tribe.slug,
    );
    const b = buildResultView(["Courageous"], "judah", null).ranked.map(
      (r) => r.tribe.slug,
    );
    expect(a).toEqual(b);
    // Zero-scoring tribes retain canonical (tribe.number) order among themselves.
    const zeros = a.filter(
      (slug) => slug !== "judah" && slug !== "reuben",
    );
    const canonicalZeros = tribes
      .map((t) => t.slug)
      .filter((slug) => zeros.includes(slug));
    expect(zeros).toEqual(canonicalZeros);
  });
});
