import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

function scoreFor(slug: string, scores: TribeScore[]): TribeScore {
  const s = scores.find((x) => x.slug === slug);
  if (!s) throw new Error(`no score for ${slug}`);
  return s;
}

/** Build a fake ranked TribeScore[] for deriveResult threshold tests. */
function makeScores(values: Record<string, number>): TribeScore[] {
  return Object.entries(values)
    .map(([slug, sc]) => ({ slug, score: sc, raw: sc, available: 1 }))
    .sort((a, b) => b.score - a.score);
}

describe("score", () => {
  it("returns a score for all 12 tribes", () => {
    const scores = score(["Bold"]);
    expect(scores).toHaveLength(tribes.length);
    expect(new Set(scores.map((s) => s.slug)).size).toBe(12);
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    const scores = score(["Bold"]); // Bold -> judah, reuben
    expect(scoreFor("judah", scores).raw).toBe(0.5);
    expect(scoreFor("reuben", scores).raw).toBe(0.5);
    expect(scoreFor("levi", scores).raw).toBe(0);
  });

  it("gives a solo word a full 1.0 point to its tribe", () => {
    const scores = score(["Aggressive"]); // Aggressive -> benjamin
    expect(scoreFor("benjamin", scores).raw).toBe(1);
  });

  it("splits a three-tribe word 0.5 to each tribe", () => {
    const scores = score(["Zealous"]); // Zealous -> judah, benjamin, simeon
    expect(scoreFor("judah", scores).raw).toBe(0.5);
    expect(scoreFor("benjamin", scores).raw).toBe(0.5);
    expect(scoreFor("simeon", scores).raw).toBe(0.5);
  });

  it("normalizes each tribe by its own available points (coverage-fair)", () => {
    // Reuben and Issachar have different total available points, so the same
    // raw point earns a different normalized score — a low-coverage tribe is
    // not penalized for having fewer words.
    const reuben = score(["Energetic"]); // solo -> reuben
    const issachar = score(["Analytical"]); // solo -> issachar
    const r = scoreFor("reuben", reuben);
    const i = scoreFor("issachar", issachar);
    expect(r.raw).toBe(1);
    expect(i.raw).toBe(1);
    // identical raw, but normalized differently because available differs
    expect(r.score).toBeCloseTo(1 / r.available);
    expect(i.score).toBeCloseTo(1 / i.available);
    expect(r.score).toBeGreaterThan(i.score);
  });

  it("yields a normalized score of 1.0 when a tribe's words are all picked", () => {
    const gadWords = words
      .filter((w) => w.tribes.includes("gad"))
      .map((w) => w.word);
    const scores = score(gadWords);
    expect(scoreFor("gad", scores).score).toBeCloseTo(1);
  });

  it("keeps every normalized score within 0..1", () => {
    const scores = score(words.map((w) => w.word));
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("ranks scores in descending order", () => {
    const scores = score(["Bold", "Strong", "Courageous", "Honorable"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const scores = makeScores({ judah: 0.7, levi: 0.3, dan: 0.1 });
    const result = deriveResult(scores);
    expect(result.primary.slug).toBe("judah");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const scores = makeScores({ judah: 1.0, reuben: 0.9, dan: 0.2 });
    const result = deriveResult(scores);
    expect(result.secondary?.slug).toBe("reuben");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const scores = makeScores({ judah: 1.0, reuben: 0.4, dan: 0.2 });
    const result = deriveResult(scores);
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const scores = makeScores({ judah: 1.0, reuben: 0.9, dan: 0.88 });
    const result = deriveResult(scores);
    expect(result.secondary).toBeUndefined();
  });

  it("returns no Secondary when nothing was scored", () => {
    const scores = makeScores({ judah: 0, reuben: 0, dan: 0 });
    const result = deriveResult(scores);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("derives a result end-to-end from selected words", () => {
    const result = deriveResult(score(["Bold", "Strong", "Courageous"]));
    expect(result.primary.slug).toBe("judah");
  });
});
