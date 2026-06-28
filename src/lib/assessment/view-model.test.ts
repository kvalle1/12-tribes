import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { buildResultView } from "./view-model";

/** Pick the words mapping to a tribe so we can drive a known leader. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("buildResultView", () => {
  it("ranks all 12 tribes by normalized score, descending", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView(words, "judah");

    expect(view.ranking).toHaveLength(12);
    expect(view.ranking.map((r) => r.slug).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (let i = 1; i < view.ranking.length; i++) {
      expect(view.ranking[i - 1].score).toBeGreaterThanOrEqual(
        view.ranking[i].score,
      );
    }
  });

  it("scales each bar fraction against the top tribe", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const view = buildResultView(words, "judah");

    expect(view.ranking[0].fraction).toBe(1);
    for (const row of view.ranking) {
      expect(row.fraction).toBeGreaterThanOrEqual(0);
      expect(row.fraction).toBeLessThanOrEqual(1);
      const expected = view.ranking[0].score
        ? row.score / view.ranking[0].score
        : 0;
      expect(row.fraction).toBeCloseTo(expected);
    }
  });

  it("matches the raw normalized scores from the scoring core", () => {
    const words = wordsForTribe("levi").slice(0, 6);
    const view = buildResultView(words, "levi");
    const raw = new Map(score(words).map((s) => [s.slug, s.score]));

    for (const row of view.ranking) {
      expect(row.score).toBeCloseTo(raw.get(row.slug)!);
    }
  });

  it("carries every ranked tribe's accent color from the source of truth", () => {
    const view = buildResultView(wordsForTribe("dan").slice(0, 4), "dan");
    const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));
    for (const row of view.ranking) {
      expect(row.color).toBe(colorBySlug.get(row.slug));
    }
  });

  it("resolves the stored headline slugs and passes the words through unchanged", () => {
    const words = ["Courageous", "Loyal", "Strategic"];
    const view = buildResultView(words, "judah", "benjamin");

    expect(view.primary.slug).toBe("judah");
    expect(view.secondary?.slug).toBe("benjamin");
    expect(view.words).toEqual(words);
  });

  it("yields all-zero scores and fractions for an empty selection", () => {
    const view = buildResultView([], "judah");
    expect(view.ranking.every((r) => r.score === 0 && r.fraction === 0)).toBe(
      true,
    );
  });
});
