import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import { deriveResult, score, type TribeScore } from "./score";

/** Convenience: slug → normalized score. */
function scoreMap(selected: string[]): Map<string, number> {
  return new Map(score(selected).map((s) => [s.slug, s.score]));
}

/** All words mapped to a given tribe slug. */
function wordsFor(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Honorable", "Bold"]);
    expect(scores).toHaveLength(tribes.length);
    for (const { score: s } of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("ranks tribes by score, descending", () => {
    const scores = score(["Honorable", "Courageous", "Bold"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("scores zero for every tribe when nothing is selected", () => {
    expect(score([]).every((s) => s.score === 0)).toBe(true);
  });

  it("ignores unknown words in the selection", () => {
    expect(scoreMap(["NotAWord"]).get("judah")).toBe(0);
  });

  it("counts a shared word as 0.5 to each of its tribes", () => {
    // "Honorable" is solo→judah (weight 1); "Bold" is shared→judah+reuben
    // (weight 0.5 each). Same tribe, same denominator: the shared word should
    // contribute exactly half of what the solo word does.
    const solo = scoreMap(["Honorable"]).get("judah")!;
    const shared = scoreMap(["Bold"]).get("judah")!;
    expect(shared).toBeCloseTo(solo / 2, 10);

    // And the other half lands on the second tribe — "Bold" lifts reuben too.
    expect(scoreMap(["Bold"]).get("reuben")!).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi has 6 words, Dan has 11 — picking every word a tribe maps to should
    // max that tribe at 1.0 regardless of how many words it has.
    expect(scoreMap(wordsFor("levi")).get("levi")).toBeCloseTo(1, 10);
    expect(scoreMap(wordsFor("dan")).get("dan")).toBeCloseTo(1, 10);
  });
});

describe("deriveResult", () => {
  /** Build an unsorted score list keyed by real slugs. */
  function scores(entries: Record<string, number>): TribeScore[] {
    return Object.entries(entries).map(([slug, s]) => ({ slug, score: s }));
  }

  it("always returns the highest-scoring tribe as primary", () => {
    const result = deriveResult(
      scores({ levi: 0.3, judah: 0.9, dan: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
  });

  it("derives the primary from a real selection", () => {
    const result = deriveResult(score(["Honorable", "Courageous", "Authoritative"]));
    expect(result.primary.slug).toBe("judah");
  });

  it("names a secondary when it is near the primary and clear of the third", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.9, dan: 0.5 }),
    );
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the secondary when the runner-up is far behind the primary", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.5, dan: 0.1 }),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.9, dan: 0.85 }),
    );
    expect(result.secondary).toBeUndefined();
  });
});
