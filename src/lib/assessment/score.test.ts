import { describe, expect, it } from "vitest";
import {
  availablePointsByTribe,
  deriveResult,
  score,
  type TribeScore,
} from "./score";

function scoreFor(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

describe("score", () => {
  it("returns a normalized score for all 12 tribes, ranked high to low", () => {
    const scores = score(["Aggressive"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    // Sorted descending.
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("counts an exclusive word as a full point to its tribe", () => {
    const available = availablePointsByTribe();
    const scores = score(["Aggressive"]); // Benjamin only
    expect(scoreFor(scores, "benjamin")).toBeCloseTo(1 / available.benjamin);
  });

  it("splits a shared word as 0.5 to each of its tribes", () => {
    const available = availablePointsByTribe();
    const scores = score(["Bold"]); // Judah + Reuben, shared
    expect(scoreFor(scores, "judah")).toBeCloseTo(0.5 / available.judah);
    expect(scoreFor(scores, "reuben")).toBeCloseTo(0.5 / available.reuben);
  });

  it("normalizes by available points so differently-sized tribes compete fairly", () => {
    // Naphtali is covered entirely by exclusive words (6 of them); selecting
    // them all earns a perfect 1.0.
    const naphtali = [
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ];
    expect(scoreFor(score(naphtali), "naphtali")).toBeCloseTo(1);

    // Issachar is a much larger, partly-shared tribe; selecting every word that
    // maps to it also earns exactly 1.0 — size confers no advantage.
    const issachar = [
      "Analytical",
      "Cautious",
      "Discerning",
      "Insightful",
      "Learned",
      "Measured",
      "Observant",
      "Patient",
      "Perceptive",
      "Strategic",
      "Wise",
    ];
    expect(scoreFor(score(issachar), "issachar")).toBeCloseTo(1);
  });

  it("ignores unknown and duplicate selections", () => {
    const once = score(["Aggressive"]);
    const noisy = score(["Aggressive", "Aggressive", "not-a-word"]);
    expect(scoreFor(noisy, "benjamin")).toBeCloseTo(scoreFor(once, "benjamin"));
  });
});

describe("deriveResult", () => {
  const scores = (entries: Record<string, number>): TribeScore[] =>
    Object.entries(entries).map(([slug, score]) => ({ slug, score }));

  it("always names the highest-scoring tribe as Primary", () => {
    const result = deriveResult(
      scores({ judah: 0.4, dan: 0.9, levi: 0.2 }),
    );
    expect(result.primary).toBe("dan");
  });

  it("names a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.9, dan: 0.5, levi: 0.3 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.5, dan: 0.4 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.85, dan: 0.84 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns only a Primary (no Secondary) when nothing was earned", () => {
    // All-zero scores tie; the result is deterministic (alphabetical) and never
    // fabricates a Secondary.
    const result = deriveResult(scores({ judah: 0, benjamin: 0, dan: 0 }));
    expect(result.primary).toBe("benjamin");
    expect(result.secondary).toBeUndefined();
  });

  it("composes with score() end to end", () => {
    const result = deriveResult(score(["Aggressive", "Fierce", "Cunning"]));
    expect(result.primary).toBe("benjamin");
  });
});
