import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "@/lib/assessment/words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

/** Convenience: pull one tribe's score out of a result array. */
function scoreFor(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

/** Every word mapped to a given tribe (for full-coverage tests). */
function wordsForTribe(slug: string): string[] {
  return words.filter((m) => m.tribes.includes(slug)).map((m) => m.word);
}

describe("score()", () => {
  it("returns one normalized 0–1 score for every tribe", () => {
    const result = score(["Courageous", "Wise", "Loyal"]);
    expect(result).toHaveLength(tribes.length);
    for (const { score: s } of result) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("scores all zero for an empty selection", () => {
    for (const { score: s } of score([])) {
      expect(s).toBe(0);
    }
  });

  it("gives a shared word half the weight of a solo word in the same tribe", () => {
    // "Courageous" is Judah-only (weight 1.0); "Bold" is Judah·Reuben (0.5 to Judah).
    const solo = scoreFor(score(["Courageous"]), "judah");
    const shared = scoreFor(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(0.5 * solo, 10);
  });

  it("splits a shared word 0.5 into EACH of its two tribes", () => {
    // "Bold" is Judah·Reuben. Compare each half against a solo word in that tribe.
    const judahSolo = scoreFor(score(["Courageous"]), "judah"); // Judah-only
    const reubenSolo = scoreFor(score(["Energetic"]), "reuben"); // Reuben-only
    const bold = score(["Bold"]);
    expect(scoreFor(bold, "judah")).toBeCloseTo(0.5 * judahSolo, 10);
    expect(scoreFor(bold, "reuben")).toBeCloseTo(0.5 * reubenSolo, 10);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi has the fewest available points, Issachar among the most. Fully
    // covering EITHER yields a perfect 1.0 — neither is structurally favored.
    expect(scoreFor(score(wordsForTribe("levi")), "levi")).toBeCloseTo(1, 10);
    expect(
      scoreFor(score(wordsForTribe("issachar")), "issachar"),
    ).toBeCloseTo(1, 10);
    expect(scoreFor(score(wordsForTribe("dan")), "dan")).toBeCloseTo(1, 10);
  });

  it("ignores unrecognized words", () => {
    const withJunk = score(["Courageous", "Flibbertigibbet"]);
    const clean = score(["Courageous"]);
    expect(scoreFor(withJunk, "judah")).toBe(scoreFor(clean, "judah"));
  });

  it("does not double-count a word selected twice", () => {
    expect(scoreFor(score(["Courageous", "Courageous"]), "judah")).toBe(
      scoreFor(score(["Courageous"]), "judah"),
    );
  });
});

describe("deriveResult()", () => {
  const others = (top: TribeScore[]): TribeScore[] => {
    // Pad with zero-scored tribes so we always have a full field.
    const used = new Set(top.map((t) => t.slug));
    const filler = tribes
      .filter((t) => !used.has(t.slug))
      .map((t) => ({ slug: t.slug, score: 0 }));
    return [...top, ...filler];
  };

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(
      others([
        { slug: "judah", score: 0.9 },
        { slug: "dan", score: 0.4 },
      ]),
    );
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      others([
        { slug: "judah", score: 1.0 },
        { slug: "benjamin", score: 0.85 }, // within 20% of primary
        { slug: "dan", score: 0.5 }, // clearly behind second
      ]),
    );
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      others([
        { slug: "judah", score: 1.0 },
        { slug: "benjamin", score: 0.5 }, // below the 0.8 ratio
        { slug: "dan", score: 0.2 },
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      others([
        { slug: "judah", score: 1.0 },
        { slug: "benjamin", score: 0.85 }, // near primary...
        { slug: "dan", score: 0.84 }, // ...but third is right behind it
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("names no Secondary when nothing was selected (all zero)", () => {
    const result = deriveResult(others([]));
    expect(result.primary.score).toBe(0);
    expect(result.secondary).toBeUndefined();
  });

  it("breaks Primary ties deterministically by canonical tribe order", () => {
    // judah (#1) precedes dan (#7); given a tie, judah wins regardless of input order.
    const a = deriveResult(
      others([
        { slug: "dan", score: 0.7 },
        { slug: "judah", score: 0.7 },
      ]),
    );
    expect(a.primary.slug).toBe("judah");
  });

  it("throws on an empty score array", () => {
    expect(() => deriveResult([])).toThrow();
  });
});

describe("score() + deriveResult() end to end", () => {
  it("names the fully-covered tribe as Primary", () => {
    const result = deriveResult(score(wordsForTribe("levi")));
    expect(result.primary.slug).toBe("levi");
    expect(result.primary.score).toBeCloseTo(1, 10);
  });
});
