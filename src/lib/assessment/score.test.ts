import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  deriveResult,
  score,
  type TribeScore,
} from "./score";

/** Convenience: look up a single tribe's normalized score from a result set. */
function scoreOf(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const scores = score([]);
    expect(scores).toHaveLength(tribes.length);
    expect(scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const { score: value } of scores) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores an empty selection as all zeros", () => {
    for (const { score: value } of score([])) {
      expect(value).toBe(0);
    }
  });

  it("gives a shared word half the weight of an exclusive word, to each tribe", () => {
    // 'Generous' is shared (zebulun + asher); 'Enterprising' is exclusive to
    // zebulun; 'Comforting' is exclusive to asher. Same denominator per tribe,
    // so the shared word must land at exactly half the exclusive word's score.
    const sharedZebulun = scoreOf(score(["Generous"]), "zebulun");
    const exclusiveZebulun = scoreOf(score(["Enterprising"]), "zebulun");
    const sharedAsher = scoreOf(score(["Generous"]), "asher");
    const exclusiveAsher = scoreOf(score(["Comforting"]), "asher");

    expect(sharedZebulun).toBeCloseTo(exclusiveZebulun * 0.5);
    expect(sharedAsher).toBeCloseTo(exclusiveAsher * 0.5);
    // 'to each' — both mapped tribes actually receive points.
    expect(sharedZebulun).toBeGreaterThan(0);
    expect(sharedAsher).toBeGreaterThan(0);
  });

  it("splits the lone three-tribe word (Zealous) 0.5 to each of its tribes", () => {
    const judah = scoreOf(score(["Zealous"]), "judah");
    const exclusiveJudah = scoreOf(score(["Courageous"]), "judah"); // exclusive
    expect(judah).toBeCloseTo(exclusiveJudah * 0.5);
    expect(scoreOf(score(["Zealous"]), "benjamin")).toBeGreaterThan(0);
    expect(scoreOf(score(["Zealous"]), "simeon")).toBeGreaterThan(0);
  });

  it("normalizes by available points so small and large tribes compete fairly", () => {
    // Fully covering a small tribe maxes it out at 1.0...
    const naphtaliWords = [
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ];
    expect(scoreOf(score(naphtaliWords), "naphtali")).toBeCloseTo(1);

    // ...and a single exclusive word is worth more to the smaller-coverage tribe
    // (naphtali, 6 words) than to a larger one (issachar), despite equal raw
    // weight — that is the coverage-fair normalization.
    const oneNaphtali = scoreOf(score(["Creative"]), "naphtali");
    const oneIssachar = scoreOf(score(["Analytical"]), "issachar");
    expect(oneNaphtali).toBeGreaterThan(oneIssachar);
  });
});

describe("deriveResult", () => {
  const result = (entries: Array<[string, number]>) =>
    deriveResult(entries.map(([slug, score]) => ({ slug, score })));

  it("always names the highest-scoring tribe as Primary, regardless of input order", () => {
    const r = result([
      ["a", 0.3],
      ["b", 0.9],
      ["c", 0.5],
    ]);
    expect(r.primary.slug).toBe("b");
  });

  it("returns a Primary and no Secondary for an all-zero selection", () => {
    const r = deriveResult(score([]));
    expect(r.primary).toBeDefined();
    expect(r.secondary).toBeUndefined();
  });

  it("names a Secondary when it is near Primary and clearly ahead of the third", () => {
    const r = result([
      ["a", 0.9],
      ["b", 0.8], // 0.8 ≥ 0.9*0.8 (near) and 0.8 ≥ 0.3*1.2 (clearly ahead)
      ["c", 0.3],
    ]);
    expect(r.primary.slug).toBe("a");
    expect(r.secondary?.slug).toBe("b");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const r = result([
      ["a", 0.9],
      ["b", 0.5], // 0.5 < 0.9*0.8 → not near Primary
      ["c", 0.1],
    ]);
    expect(r.primary.slug).toBe("a");
    expect(r.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const r = result([
      ["a", 0.9],
      ["b", 0.8], // near Primary, but...
      ["c", 0.75], // 0.8 < 0.75*1.2 → not clearly ahead of third
    ]);
    expect(r.primary.slug).toBe("a");
    expect(r.secondary).toBeUndefined();
  });

  it("produces a usable headline end-to-end from selected words", () => {
    // 5 exclusive levi words + 5 exclusive naphtali words → two close leaders.
    const picks = [
      "Dedicated",
      "Devoted",
      "Exacting",
      "Precise",
      "Reverent", // levi (5/5.5 ≈ 0.909)
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing", // naphtali (5/6 ≈ 0.833)
    ];
    const r = deriveResult(score(picks));
    expect(r.primary.slug).toBe("levi");
    expect(r.secondary?.slug).toBe("naphtali");
  });
});
