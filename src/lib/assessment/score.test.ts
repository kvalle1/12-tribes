import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { wordMappings } from "@/lib/assessment/words";
import {
  score,
  deriveResult,
  type TribeScore,
  SECONDARY_MIN_RATIO_OF_PRIMARY,
  THIRD_MAX_RATIO_OF_SECONDARY,
} from "@/lib/assessment/score";

/** Pull a single tribe's normalized score out of a score list. */
function scoreOf(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

/** All words mapped to a given tribe (used to "max out" that tribe). */
function wordsFor(slug: string): string[] {
  return wordMappings.filter((m) => m.tribes.includes(slug)).map((m) => m.word);
}

/** Build a synthetic score list directly, for testing deriveResult in isolation. */
function makeScores(entries: Record<string, number>): TribeScore[] {
  return Object.entries(entries).map(([slug, score]) => ({ slug, score }));
}

describe("score()", () => {
  it("returns a normalized score for every one of the 12 tribes", () => {
    const scores = score(["Courageous"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("ranks the scores highest-first", () => {
    const scores = score(["Courageous", "Honorable", "Authoritative"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
    expect(scores[0].slug).toBe("judah");
  });

  it("normalizes by a tribe's available points (solo word = 1 / available)", () => {
    // Judah's available points across the list total 6.5 (4 solo + 5 shared).
    expect(scoreOf(score(["Courageous"]), "judah")).toBeCloseTo(1 / 6.5);
  });

  it("gives a shared word 0.5 to each tribe — half of what a solo word gives", () => {
    // "Bold" is shared judah·reuben; "Courageous" is solo judah, "Energetic" solo reuben.
    const judahSolo = scoreOf(score(["Courageous"]), "judah");
    const judahShared = scoreOf(score(["Bold"]), "judah");
    expect(judahShared).toBeCloseTo(judahSolo / 2);

    const reubenSolo = scoreOf(score(["Energetic"]), "reuben");
    const reubenShared = scoreOf(score(["Bold"]), "reuben");
    expect(reubenShared).toBeCloseTo(reubenSolo / 2);
  });

  it("treats a three-way shared word (Zealous) as 0.5 to each of its tribes", () => {
    const zealous = score(["Zealous"]);
    expect(scoreOf(zealous, "judah")).toBeCloseTo(scoreOf(score(["Courageous"]), "judah") / 2);
    expect(scoreOf(zealous, "benjamin")).toBeCloseTo(scoreOf(score(["Aggressive"]), "benjamin") / 2);
    expect(scoreOf(zealous, "simeon")).toBeCloseTo(scoreOf(score(["Just"]), "simeon") / 2);
  });

  it("normalizes coverage fairly: fully describing any tribe scores 1.0 regardless of word count", () => {
    // Levi (6 words) and Issachar (10 words) both reach exactly 1.0 when maxed.
    expect(scoreOf(score(wordsFor("levi")), "levi")).toBeCloseTo(1);
    expect(scoreOf(score(wordsFor("issachar")), "issachar")).toBeCloseTo(1);
    expect(scoreOf(score(wordsFor("benjamin")), "benjamin")).toBeCloseTo(1);
  });

  it("ignores words that are not in the list", () => {
    expect(scoreOf(score(["Courageous", "NotAWord"]), "judah")).toBeCloseTo(1 / 6.5);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(makeScores({ judah: 0.4, levi: 0.2, dan: 0.1 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("sorts an unordered input before choosing the Primary", () => {
    const result = deriveResult(makeScores({ dan: 0.1, judah: 0.9, levi: 0.3 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("breaks ties deterministically by canonical tribe number", () => {
    // judah is number 1, levi number 2 — judah wins an exact tie.
    const result = deriveResult(makeScores({ levi: 0.5, judah: 0.5 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(makeScores({ judah: 1.0, levi: 0.9, dan: 0.5 }));
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(makeScores({ judah: 1.0, levi: 0.6, dan: 0.3 }));
    expect(result.secondary).toBeUndefined();
    expect(result.primary.slug).toBe("judah");
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(makeScores({ judah: 1.0, levi: 0.9, dan: 0.8 }));
    expect(result.secondary).toBeUndefined();
  });

  it("never reports a Secondary with a zero score", () => {
    const result = deriveResult(makeScores({ judah: 0.5, levi: 0, dan: 0 }));
    expect(result.secondary).toBeUndefined();
  });

  it("returns Primary-only when no tribe scored above zero", () => {
    const result = deriveResult(makeScores({ judah: 0, levi: 0 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("exposes tunable threshold constants", () => {
    expect(SECONDARY_MIN_RATIO_OF_PRIMARY).toBeGreaterThan(0);
    expect(SECONDARY_MIN_RATIO_OF_PRIMARY).toBeLessThanOrEqual(1);
    expect(THIRD_MAX_RATIO_OF_SECONDARY).toBeGreaterThan(0);
    expect(THIRD_MAX_RATIO_OF_SECONDARY).toBeLessThanOrEqual(1);
  });
});

describe("score() + deriveResult() end to end", () => {
  it("names the fully-described tribe as Primary", () => {
    const result = deriveResult(score(wordsFor("issachar")));
    expect(result.primary.slug).toBe("issachar");
    expect(result.primary.score).toBeCloseTo(1);
  });
});
