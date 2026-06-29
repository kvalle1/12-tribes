import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { buildResultView } from "./result-view";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("buildResultView", () => {
  it("returns a bar for all 12 tribes, ranked by score descending", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView({
      words,
      primarySlug: "judah",
      secondarySlug: null,
    });

    expect(view.bars).toHaveLength(12);
    expect(view.bars.map((b) => b.tribe.slug)).toHaveLength(12);
    // Strictly non-increasing scores.
    for (let i = 1; i < view.bars.length; i++) {
      expect(view.bars[i - 1].score).toBeGreaterThanOrEqual(view.bars[i].score);
    }
    // Every bar references a real tribe.
    for (const bar of view.bars) {
      expect(tribes.some((t) => t.slug === bar.tribe.slug)).toBe(true);
    }
  });

  it("carries each bar's normalized score and an integer percent", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView({
      words,
      primarySlug: "judah",
      secondarySlug: null,
    });
    const scores = score(words);

    for (const bar of view.bars) {
      const raw = scores.find((s) => s.slug === bar.tribe.slug)!.score;
      expect(bar.score).toBeCloseTo(raw, 10);
      expect(bar.percent).toBe(Math.round(raw * 100));
      expect(Number.isInteger(bar.percent)).toBe(true);
    }
  });

  it("scales the bar fill so the top-scoring tribe fills the track", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView({
      words,
      primarySlug: "judah",
      secondarySlug: null,
    });

    const leader = view.bars[0];
    expect(leader.fill).toBeCloseTo(1, 10);
    for (const bar of view.bars) {
      expect(bar.fill).toBeGreaterThanOrEqual(0);
      expect(bar.fill).toBeLessThanOrEqual(1);
      // fill is score relative to the leader.
      expect(bar.fill).toBeCloseTo(bar.score / leader.score, 10);
    }
  });

  it("flags the stored Primary and Secondary among the bars", () => {
    const view = buildResultView({
      words: wordsForTribe("judah").slice(0, 5),
      primarySlug: "judah",
      secondarySlug: "levi",
    });

    const primaryBar = view.bars.find((b) => b.tribe.slug === "judah");
    const secondaryBar = view.bars.find((b) => b.tribe.slug === "levi");
    expect(primaryBar?.isPrimary).toBe(true);
    expect(primaryBar?.isSecondary).toBe(false);
    expect(secondaryBar?.isSecondary).toBe(true);
    expect(secondaryBar?.isPrimary).toBe(false);

    // Exactly one primary, exactly one secondary.
    expect(view.bars.filter((b) => b.isPrimary)).toHaveLength(1);
    expect(view.bars.filter((b) => b.isSecondary)).toHaveLength(1);
  });

  it("flags no Secondary when the stored result is Primary-only", () => {
    const view = buildResultView({
      words: wordsForTribe("judah").slice(0, 5),
      primarySlug: "judah",
      secondarySlug: null,
    });
    expect(view.secondary).toBeUndefined();
    expect(view.bars.some((b) => b.isSecondary)).toBe(false);
  });

  it("resolves the Primary and Secondary tribe objects for the headline", () => {
    const view = buildResultView({
      words: wordsForTribe("judah").slice(0, 5),
      primarySlug: "judah",
      secondarySlug: "levi",
    });
    expect(view.primary.slug).toBe("judah");
    expect(view.secondary?.slug).toBe("levi");
  });

  it("passes the selected words through unchanged", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView({
      words,
      primarySlug: "judah",
      secondarySlug: null,
    });
    expect(view.words).toEqual(words);
  });

  it("handles an empty selection without dividing by zero", () => {
    const view = buildResultView({
      words: [],
      primarySlug: "judah",
      secondarySlug: null,
    });
    expect(view.bars).toHaveLength(12);
    for (const bar of view.bars) {
      expect(bar.score).toBe(0);
      expect(bar.percent).toBe(0);
      expect(bar.fill).toBe(0);
    }
  });
});
