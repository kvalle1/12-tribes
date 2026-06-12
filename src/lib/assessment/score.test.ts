import { describe, expect, it } from "vitest";
import {
  AssessmentResult,
  TribeScore,
  deriveResult,
  score,
} from "./score";
import { words } from "./words";

/** Every word in the list that maps to the given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((m) => m.tribes.includes(slug)).map((m) => m.word);
}

/** Pull one tribe's normalized score out of a score() result. */
function scoreFor(result: TribeScore[], slug: string): number {
  const found = result.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

describe("score", () => {
  it("returns a normalized [0, 1] score for every tribe", () => {
    const result = score(["Courageous", "Bold"]);
    expect(result).toHaveLength(12);
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives 0 to every tribe when nothing is selected", () => {
    for (const s of score([])) {
      expect(s.score).toBe(0);
    }
  });

  it("ignores words that are not in the list", () => {
    expect(score(["Definitely-Not-A-Word"])).toEqual(score([]));
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" is shared (judah, reuben); "Courageous" is a solo judah word and
    // "Energetic" a solo reuben word. The shared word must contribute exactly
    // half of what a solo word does to the same tribe.
    const boldJudah = scoreFor(score(["Bold"]), "judah");
    const soloJudah = scoreFor(score(["Courageous"]), "judah");
    expect(boldJudah).toBeCloseTo(soloJudah * 0.5);

    const boldReuben = scoreFor(score(["Bold"]), "reuben");
    const soloReuben = scoreFor(score(["Energetic"]), "reuben");
    expect(boldReuben).toBeCloseTo(soloReuben * 0.5);
  });

  it("normalizes by coverage so small and large tribes compete fairly", () => {
    // Levi has far fewer words than Issachar. Selecting *all* of each tribe's
    // words must max both out at 1.0 — coverage doesn't give an advantage.
    const allLevi = wordsForTribe("levi");
    const allIssachar = wordsForTribe("issachar");
    expect(allLevi.length).toBeLessThan(allIssachar.length);

    const result = score([...allLevi, ...allIssachar]);
    expect(scoreFor(result, "levi")).toBeCloseTo(1);
    expect(scoreFor(result, "issachar")).toBeCloseTo(1);
  });
});

describe("deriveResult", () => {
  function mk(entries: Array<[string, number]>): TribeScore[] {
    return entries.map(([slug, score]) => ({ slug, name: slug, score }));
  }

  it("always returns the highest-scoring tribe as Primary", () => {
    const result: AssessmentResult = deriveResult(
      mk([
        ["a", 0.3],
        ["b", 0.9],
        ["c", 0.5],
      ]),
    );
    expect(result.primary.slug).toBe("b");
  });

  it("shows a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(
      mk([
        ["a", 1.0],
        ["b", 0.9],
        ["c", 0.5],
      ]),
    );
    expect(result.secondary?.slug).toBe("b");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      mk([
        ["a", 1.0],
        ["b", 0.5],
        ["c", 0.4],
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      mk([
        ["a", 1.0],
        ["b", 0.85],
        ["c", 0.82],
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("never invents a Secondary when no words were selected", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });
});
