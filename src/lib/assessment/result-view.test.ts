import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { deriveResult, score } from "./score";
import { buildResultView } from "./result-view";

/**
 * A representative selection that lands a clear Primary (and, here, a Secondary).
 * The slugs the view is built against come from the same derivation the
 * repository uses, mirroring how a saved result is produced.
 */
const WORDS = [
  "Authoritative",
  "Aggressive",
  "Alert",
  "Analytical",
  "Battle-tested",
];

function buildFromWords(words: readonly string[]) {
  const { primary, secondary } = deriveResult(score(words));
  return buildResultView({
    words,
    primarySlug: primary.slug,
    secondarySlug: secondary?.slug ?? null,
  });
}

describe("buildResultView", () => {
  it("ranks all 12 tribes by descending normalized score", () => {
    const view = buildFromWords(WORDS);
    expect(view.ranked).toHaveLength(tribes.length);
    for (let i = 1; i < view.ranked.length; i++) {
      expect(view.ranked[i - 1].score).toBeGreaterThanOrEqual(
        view.ranked[i].score,
      );
    }
  });

  it("breaks score ties in canonical tribe order", () => {
    // No words → every tribe scores 0, so ranking must keep tribes.ts order.
    const view = buildResultView({ words: [], primarySlug: "judah" });
    expect(view.ranked.map((r) => r.tribe.number)).toEqual(
      tribes.map((t) => t.number),
    );
  });

  it("scales bar widths relative to the top score (leader fills the bar)", () => {
    const view = buildFromWords(WORDS);
    const max = Math.max(...view.ranked.map((r) => r.score));
    expect(view.ranked[0].barPct).toBe(100);
    for (const row of view.ranked) {
      expect(row.barPct).toBeCloseTo((row.score / max) * 100, 10);
      expect(row.barPct).toBeGreaterThanOrEqual(0);
      expect(row.barPct).toBeLessThanOrEqual(100);
    }
  });

  it("gives every bar a 0 width when nothing scored", () => {
    const view = buildResultView({ words: [], primarySlug: "judah" });
    expect(view.ranked.every((r) => r.barPct === 0)).toBe(true);
  });

  it("flags exactly the stored Primary and Secondary", () => {
    const { primary, secondary } = deriveResult(score(WORDS));
    const view = buildFromWords(WORDS);

    const primaryRows = view.ranked.filter((r) => r.isPrimary);
    expect(primaryRows).toHaveLength(1);
    expect(primaryRows[0].tribe.slug).toBe(primary.slug);
    expect(view.primary.slug).toBe(primary.slug);

    const secondaryRows = view.ranked.filter((r) => r.isSecondary);
    if (secondary) {
      expect(secondaryRows).toHaveLength(1);
      expect(secondaryRows[0].tribe.slug).toBe(secondary.slug);
      expect(view.secondary?.slug).toBe(secondary.slug);
    } else {
      expect(secondaryRows).toHaveLength(0);
      expect(view.secondary).toBeUndefined();
    }
  });

  it("echoes the Subject's selected words for display", () => {
    const view = buildFromWords(WORDS);
    expect(view.words).toEqual(WORDS);
  });

  it("throws on an unknown primary slug", () => {
    expect(() =>
      buildResultView({ words: WORDS, primarySlug: "nephilim" }),
    ).toThrow();
  });
});
