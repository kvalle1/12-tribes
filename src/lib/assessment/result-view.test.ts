import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, deriveResult } from "./score";
import { buildResultView } from "./result-view";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Build the saved-row shape from a word selection by running the scoring core. */
const rowFor = (words: string[]) => {
  const { primary, secondary } = deriveResult(score(words));
  return {
    words,
    primarySlug: primary.slug,
    secondarySlug: secondary?.slug ?? null,
  };
};

describe("buildResultView", () => {
  it("ranks all 12 tribes by normalized score, highest first", () => {
    const view = buildResultView(rowFor(wordsForTribe("levi")));
    expect(view.ranked).toHaveLength(12);
    expect(new Set(view.ranked.map((r) => r.tribe.slug)).size).toBe(12);
    for (let i = 1; i < view.ranked.length; i++) {
      expect(view.ranked[i - 1].score).toBeGreaterThanOrEqual(
        view.ranked[i].score,
      );
    }
  });

  it("puts the Primary first and flags it, consistent with deriveResult", () => {
    const row = rowFor([...wordsForTribe("levi"), "Courageous"]);
    const view = buildResultView(row);
    expect(view.primary.slug).toBe(row.primarySlug);
    expect(view.ranked[0].tribe.slug).toBe(row.primarySlug);
    expect(view.ranked[0].isPrimary).toBe(true);
    expect(view.ranked.filter((r) => r.isPrimary)).toHaveLength(1);
  });

  it("flags the Secondary when the saved result has one", () => {
    // judah (#1) and benjamin (#6) tie; both qualify as Primary/Secondary.
    const row = {
      words: ["placeholder"],
      primarySlug: "judah",
      secondarySlug: "benjamin",
    };
    const view = buildResultView(row);
    expect(view.secondary?.slug).toBe("benjamin");
    expect(view.ranked.find((r) => r.tribe.slug === "benjamin")?.isSecondary).toBe(
      true,
    );
    expect(view.ranked.filter((r) => r.isSecondary)).toHaveLength(1);
  });

  it("has no Secondary flag when the saved result is Primary-only", () => {
    const view = buildResultView({
      words: ["Courageous"],
      primarySlug: "judah",
      secondarySlug: null,
    });
    expect(view.secondary).toBeUndefined();
    expect(view.ranked.some((r) => r.isSecondary)).toBe(false);
  });

  it("passes the Subject's selected words through unchanged", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const view = buildResultView({
      words,
      primarySlug: "judah",
      secondarySlug: null,
    });
    expect(view.words).toEqual(words);
  });

  it("attaches each tribe's normalized score from the scoring core", () => {
    const words = wordsForTribe("levi");
    const view = buildResultView(rowFor(words));
    const expected = score(words);
    for (const r of view.ranked) {
      const match = expected.find((s) => s.slug === r.tribe.slug)!;
      expect(r.score).toBeCloseTo(match.score);
    }
    // Carries the full Tribe object so the view can render accent + headline.
    expect(view.ranked[0].tribe).toBe(
      tribes.find((t) => t.slug === view.ranked[0].tribe.slug),
    );
  });
});
