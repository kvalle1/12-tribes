import { describe, it, expect } from "vitest";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

/** Convenience: pull one tribe's normalized score out of a scored result. */
function scoreFor(scores: TribeScore[], slug: string): number {
  return scores.find((s) => s.slug === slug)?.score ?? 0;
}

describe("score() — shared-word 0.5 split", () => {
  it("a Shared word contributes half of a full word to the same tribe", () => {
    // "Honorable" maps to Judah alone (weight 1.0); "Bold" maps to Judah+Reuben
    // (weight 0.5 to each). Same tribe, same denominator → Bold is exactly half.
    const full = scoreFor(score(["Honorable"]), "judah");
    const shared = scoreFor(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(full * 0.5, 10);
  });

  it("splits a Shared word's 0.5 to BOTH of its tribes", () => {
    // "Bold" → Judah + Reuben. Each gets half of a full word in its own tribe.
    const judahFull = scoreFor(score(["Honorable"]), "judah"); // Judah solo word
    const reubenFull = scoreFor(score(["Energetic"]), "reuben"); // Reuben solo word
    const bold = score(["Bold"]);
    expect(scoreFor(bold, "judah")).toBeCloseTo(judahFull * 0.5, 10);
    expect(scoreFor(bold, "reuben")).toBeCloseTo(reubenFull * 0.5, 10);
  });
});

describe("score() — normalization is coverage-fair", () => {
  it("returns a 0–1 value for all 12 tribes", () => {
    const scores = score(["Honorable", "Bold", "Wise"]);
    expect(scores).toHaveLength(12);
    for (const { score: s } of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("a 6-word tribe and a 10-word tribe both reach 1.0 when fully selected", () => {
    // Levi (a 6-word tribe): every word that maps to Levi.
    const leviWords = [
      "Dedicated",
      "Devoted",
      "Exacting",
      "Guarding",
      "Precise",
      "Reverent",
    ];
    expect(scoreFor(score(leviWords), "levi")).toBeCloseTo(1, 10);

    // Dan (a 10-word tribe): every word that maps to Dan.
    const danWords = [
      "Alert",
      "Cautious",
      "Cunning",
      "Deliberate",
      "Discerning",
      "Observant",
      "Perceptive",
      "Skeptical",
      "Strategic",
      "Vigilant",
      "Watchful",
    ];
    expect(scoreFor(score(danWords), "dan")).toBeCloseTo(1, 10);
  });

  it("ignores unrecognized words and counts duplicates once", () => {
    const once = score(["Honorable"]);
    const noisy = score(["Honorable", "Honorable", "not-a-word"]);
    expect(scoreFor(noisy, "judah")).toBeCloseTo(scoreFor(once, "judah"), 10);
  });

  it("returns all-zero scores for an empty selection", () => {
    for (const { score: s } of score([])) {
      expect(s).toBe(0);
    }
  });

  it("ranks the strongest tribe first", () => {
    const ranked = score(["Honorable", "Courageous", "Authoritative", "Sacrificial"]);
    expect(ranked[0].slug).toBe("judah");
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.4 },
      { slug: "levi", score: 0.2 },
      { slug: "dan", score: 0.1 },
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("finds the Primary even when input is not pre-sorted", () => {
    const result = deriveResult([
      { slug: "dan", score: 0.1 },
      { slug: "judah", score: 0.9 },
      { slug: "levi", score: 0.3 },
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary AND clearly ahead of the third", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.9 }, // ≥ 0.8 × primary
      { slug: "dan", score: 0.5 }, // ≤ 0.8 × secondary
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.5 }, // < 0.8 × primary
      { slug: "dan", score: 0.4 },
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.9 }, // near primary...
      { slug: "dan", score: 0.85 }, // ...but third is too close to the secondary
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("names no Secondary when the Primary score is zero", () => {
    const result = deriveResult([
      { slug: "judah", score: 0 },
      { slug: "levi", score: 0 },
      { slug: "dan", score: 0 },
    ]);
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });
});
