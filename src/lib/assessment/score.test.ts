import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import {
  score,
  deriveResult,
  rankByScore,
  availablePointsByTribe,
  type TribeScore,
} from "./score";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Build a synthetic score table for deriveResult tests, defaulting others to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const scores = score(["Courageous"]);
    expect(scores).toHaveLength(12);
    expect(scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero for an empty selection", () => {
    const scores = score([]);
    expect(scores.every((s) => s.score === 0)).toBe(true);
  });

  it("ignores words that are not in the list (exact-match contract)", () => {
    expect(scoreFor("judah", score(["notaword", "courageous"]))).toBe(0);
  });

  it("deduplicates repeated selections (a selection is a set)", () => {
    expect(scoreFor("judah", score(["Courageous", "Courageous"]))).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])),
    );
  });

  it("conserves exactly one point per selected word, split across its tribes", () => {
    // The central invariant of the 1/N rule: every word contributes a total of
    // one raw point regardless of how many tribes it maps to. Recover raw points
    // by multiplying each tribe's normalized score by its available points.
    const rawTotal = (selected: string[]) =>
      score(selected).reduce(
        (sum, s) => sum + s.score * availablePointsByTribe[s.slug],
        0,
      );
    expect(rawTotal(["Courageous"])).toBeCloseTo(1); // solo word
    expect(rawTotal(["Bold"])).toBeCloseTo(1); // two-tribe word (0.5 + 0.5)
    expect(rawTotal(["Zealous"])).toBeCloseTo(1); // three-tribe word (1/3 ×3)
    expect(rawTotal(["Courageous", "Bold", "Zealous"])).toBeCloseTo(3);
  });

  it("splits a two-tribe shared word 0.5 to each tribe", () => {
    const full = scoreFor("judah", score(["Courageous"])); // judah-only, full point
    const shared = scoreFor("judah", score(["Bold"])); // judah+reuben, half
    expect(shared).toBeGreaterThan(0);
    expect(full).toBeCloseTo(2 * shared);

    const bold = score(["Bold"]);
    expect(scoreFor("reuben", bold)).toBeGreaterThan(0);
    expect(scoreFor("levi", bold)).toBe(0);
  });

  it("splits the three-tribe word evenly (1/3 each)", () => {
    const full = scoreFor("judah", score(["Courageous"]));
    const third = scoreFor("judah", score(["Zealous"]));
    expect(full).toBeCloseTo(3 * third);
  });

  it("normalizes by coverage so full coverage scores 1.0 regardless of word count", () => {
    // Levi has 6 words, Issachar 10 — selecting all of a tribe's words yields a
    // perfect 1.0 for that tribe either way (coverage-fair, ADR-0001).
    expect(scoreFor("levi", score(wordsForTribe("levi")))).toBeCloseTo(1);
    expect(scoreFor("issachar", score(wordsForTribe("issachar")))).toBeCloseTo(1);
  });

  it("has positive available points for all 12 tribes (never divides by zero)", () => {
    expect(Object.keys(availablePointsByTribe)).toHaveLength(12);
    for (const tribe of tribes) {
      expect(availablePointsByTribe[tribe.slug]).toBeGreaterThan(0);
    }
  });
});

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(tableFrom({ judah: 0.8, levi: 0.3 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns a Secondary when near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(tableFrom({ judah: 1.0, reuben: 0.9, levi: 0.2 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("reuben");
  });

  it("includes the Secondary exactly at the 80% boundary", () => {
    // second is exactly 20% below primary, third clearly behind → qualifies.
    const result = deriveResult(tableFrom({ judah: 1.0, reuben: 0.8, levi: 0.2 }));
    expect(result.secondary?.slug).toBe("reuben");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(tableFrom({ judah: 1.0, reuben: 0.5, levi: 0.1 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(tableFrom({ judah: 1.0, reuben: 0.9, levi: 0.85 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns Primary-only when only one tribe scored", () => {
    const result = deriveResult(tableFrom({ judah: 0.6 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("shows a near Secondary when no third tribe scored", () => {
    const result = deriveResult(tableFrom({ judah: 1.0, reuben: 0.9 }));
    expect(result.secondary?.slug).toBe("reuben");
  });

  it("breaks ranking ties deterministically by canonical tribe order", () => {
    // judah (#1) and benjamin (#6) tie; judah wins primary by canonical order.
    const result = deriveResult(tableFrom({ judah: 0.8, benjamin: 0.8 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });
});

describe("rankByScore", () => {
  it("ranks all 12 tribes from highest score to lowest", () => {
    const ranked = rankByScore(tableFrom({ levi: 0.4, judah: 0.9, reuben: 0.6 }));
    expect(ranked).toHaveLength(12);
    expect(ranked.slice(0, 3).map((s) => s.slug)).toEqual([
      "judah",
      "reuben",
      "levi",
    ]);
    // Scores are non-increasing across the whole ranking.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }
  });

  it("breaks ties by canonical tribe order (stable sort)", () => {
    // judah (#1) and benjamin (#6) tie; judah keeps the earlier slot.
    const ranked = rankByScore(tableFrom({ judah: 0.5, benjamin: 0.5 }));
    const judahIdx = ranked.findIndex((s) => s.slug === "judah");
    const benjaminIdx = ranked.findIndex((s) => s.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("keeps an all-zero selection in canonical order", () => {
    const ranked = rankByScore(score([]));
    expect(ranked.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("does not mutate its input", () => {
    const input = tableFrom({ levi: 0.4, judah: 0.9 });
    const before = input.map((s) => s.slug);
    rankByScore(input);
    expect(input.map((s) => s.slug)).toEqual(before);
  });
});

describe("score → deriveResult (end to end)", () => {
  it("names the dominant tribe Primary from a realistic selection", () => {
    const scores = score([...wordsForTribe("levi"), "Courageous"]);
    expect(deriveResult(scores).primary.slug).toBe("levi");
  });
});
