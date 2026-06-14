import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { assessmentWords } from "./words";
import {
  score,
  deriveResult,
  SECONDARY_MARGIN,
  type TribeScore,
} from "./score";

/** Read a single tribe's normalized score out of a score() result. */
function scoreFor(slug: string, scores: TribeScore[]): number {
  const entry = scores.find((s) => s.slug === slug);
  if (!entry) throw new Error(`no score for ${slug}`);
  return entry.score;
}

/** Every word in the list that maps to the given tribe. */
function wordsForTribe(slug: string): string[] {
  return assessmentWords.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score()", () => {
  it("returns a normalized 0–1 score for every one of the 12 tribes", () => {
    const result = score(["Honorable"]);
    expect(result).toHaveLength(tribes.length);
    expect(new Set(result.map((s) => s.slug))).toEqual(new Set(tribes.map((t) => t.slug)));
    for (const { score: value } of result) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("gives nothing to any tribe when no words are selected", () => {
    expect(score([]).every((s) => s.score === 0)).toBe(true);
  });

  it("splits a shared word 0.5 / 0.5 across its two tribes", () => {
    // "Comforting" is Asher-only (weight 1); "Generous" is Zebulun+Asher (0.5 each).
    // So Asher should earn exactly half as much from Generous as from Comforting.
    const fromSole = scoreFor("asher", score(["Comforting"]));
    const fromShared = scoreFor("asher", score(["Generous"]));

    expect(fromShared).toBeGreaterThan(0);
    expect(fromSole).toBeCloseTo(fromShared * 2);

    // The other half of "Generous" lands on Zebulun.
    const generous = score(["Generous"]);
    expect(scoreFor("zebulun", generous)).toBeGreaterThan(0);
  });

  it("normalizes by available points so small and large tribes compete fairly", () => {
    // Naphtali has 6 words (all sole); Dan has 11 (a mix of sole and shared).
    // Picking ALL of a tribe's words tops it out at 1.0 regardless of count.
    const naphtaliWords = wordsForTribe("naphtali");
    const danWords = wordsForTribe("dan");
    expect(naphtaliWords.length).not.toBe(danWords.length);

    expect(scoreFor("naphtali", score(naphtaliWords))).toBeCloseTo(1);
    expect(scoreFor("dan", score(danWords))).toBeCloseTo(1);
  });

  it("ignores unknown words and double-counts nothing", () => {
    const once = score(["Honorable"]);
    const dupedWithJunk = score(["Honorable", "honorable", "Flibbertigibbet"]);
    expect(scoreFor("judah", dupedWithJunk)).toBeCloseTo(scoreFor("judah", once));
  });
});

describe("deriveResult()", () => {
  // Helper to build a full 12-tribe score array from a sparse map (rest = 0).
  function scores(overrides: Record<string, number>): TribeScore[] {
    return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
  }

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(scores({ joseph: 0.3, dan: 0.7, levi: 0.5 }));
    expect(result.primary).toBe("dan");
  });

  it("names a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.9, dan: 0.5 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.5, dan: 0.4 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is effectively tied with the third tribe", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.9, dan: 0.85 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("respects SECONDARY_MARGIN as the near-Primary threshold", () => {
    // Exactly at the boundary qualifies; just under does not.
    const atBoundary = deriveResult(scores({ judah: 1.0, benjamin: 1 - SECONDARY_MARGIN }));
    expect(atBoundary.secondary).toBe("benjamin");

    const justUnder = deriveResult(
      scores({ judah: 1.0, benjamin: 1 - SECONDARY_MARGIN - 0.01 }),
    );
    expect(justUnder.secondary).toBeUndefined();
  });

  it("returns only a Primary when a single tribe carries the result", () => {
    const result = deriveResult(score(["Honorable"]));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
