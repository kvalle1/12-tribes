import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  deriveResult,
  getAvailablePoints,
  score,
  type TribeScore,
} from "./score";

/** Convenience: look up a tribe's normalized score by slug. */
function scoreFor(selected: string[], slug: string): number {
  const result = score(selected).find((s) => s.slug === slug);
  if (!result) throw new Error(`no score for ${slug}`);
  return result.score;
}

/** Build a synthetic score array (canonical tribe order) from a slug→score map. */
function scoresFrom(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
}

describe("score()", () => {
  it("returns a normalized [0,1] score for all 12 tribes", () => {
    const result = score(["Bold", "Courageous", "Wise"]);
    expect(result).toHaveLength(12);
    for (const { score: s } of result) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" → judah + reuben (shared, 0.5 each).
    // "Courageous" → judah only (1.0). "Energetic" → reuben only (1.0).
    // The shared word must contribute exactly half of a sole word's points.
    expect(scoreFor(["Bold"], "judah") / scoreFor(["Courageous"], "judah")).toBe(
      0.5,
    );
    expect(
      scoreFor(["Bold"], "reuben") / scoreFor(["Energetic"], "reuben"),
    ).toBe(0.5);
  });

  it("counts a sole-tribe word as a full point", () => {
    // Levi has 5.5 available points; "Dedicated" is a sole-tribe Levi word (1.0).
    const available = getAvailablePoints().levi;
    expect(scoreFor(["Dedicated"], "levi")).toBeCloseTo(1 / available, 10);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi (6 words, all of them) and Dan (11 words, all of them) both reach a
    // perfect 1.0 despite very different coverage — the low-coverage tribe is
    // not penalized.
    const allLevi = ["Dedicated", "Devoted", "Exacting", "Guarding", "Precise", "Reverent"];
    const allDan = [
      "Alert", "Cautious", "Cunning", "Deliberate", "Discerning", "Observant",
      "Perceptive", "Skeptical", "Strategic", "Vigilant", "Watchful",
    ];
    expect(scoreFor(allLevi, "levi")).toBeCloseTo(1, 10);
    expect(scoreFor(allDan, "dan")).toBeCloseTo(1, 10);
  });

  it("ignores unknown words and de-duplicates repeats", () => {
    expect(scoreFor(["Courageous", "Courageous"], "judah")).toBe(
      scoreFor(["Courageous"], "judah"),
    );
    expect(scoreFor(["NotAWord"], "judah")).toBe(0);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(scoresFrom({ dan: 0.9, judah: 0.4 }));
    expect(result.primary.slug).toBe("dan");
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of third", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.9, benjamin: 0.8, dan: 0.4 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.9, benjamin: 0.6, dan: 0.2 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.9, benjamin: 0.8, dan: 0.78 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("never names a zero-scoring Secondary", () => {
    const result = deriveResult(scoresFrom({ judah: 0.5 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("derives an end-to-end result from a real selection", () => {
    // A Judah-leaning selection: mostly sole-Judah words.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
