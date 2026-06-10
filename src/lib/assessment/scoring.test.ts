import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import {
  type TribeScores,
  deriveResult,
  score,
} from "./scoring";

/** Every word mapped to a given tribe — used to "fully sweep" a tribe. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

/** Build a full 12-tribe score map from a partial override (rest default 0). */
function makeScores(overrides: TribeScores): TribeScores {
  const scores: TribeScores = {};
  for (const tribe of tribes) scores[tribe.slug] = overrides[tribe.slug] ?? 0;
  return scores;
}

describe("score", () => {
  it("returns a value for all 12 tribes", () => {
    const scores = score([]);
    expect(Object.keys(scores)).toHaveLength(12);
    for (const tribe of tribes) {
      expect(scores[tribe.slug]).toBe(0);
    }
  });

  it("returns normalized 0–1 values", () => {
    const scores = score(["Bold", "Courageous", "Honorable", "Strong"]);
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each of its tribes (half of a solo word)", () => {
    // "Bold" is shared (Judah · Reuben); "Courageous" is a Judah solo word,
    // "Energetic" a Reuben solo word. A shared word should contribute exactly
    // half of what a solo word does to the same tribe.
    const judahSolo = score(["Courageous"]).judah;
    const judahShared = score(["Bold"]).judah;
    expect(judahShared).toBeGreaterThan(0);
    expect(judahSolo).toBeCloseTo(2 * judahShared);

    const reubenSolo = score(["Energetic"]).reuben;
    const reubenShared = score(["Bold"]).reuben;
    expect(reubenShared).toBeGreaterThan(0);
    expect(reubenSolo).toBeCloseTo(2 * reubenShared);
  });

  it("normalizes by available points so different-sized tribes compete fairly", () => {
    // Levi has 6 words, Joseph has more; sweeping all of either tribe's words
    // maxes that tribe at 1.0 regardless of how many words it has.
    expect(score(wordsForTribe("levi")).levi).toBeCloseTo(1);
    expect(score(wordsForTribe("joseph")).joseph).toBeCloseTo(1);

    // A single solo word is worth more to a small-coverage tribe than to a
    // large-coverage one — that is the point of normalization.
    const leviOneWord = score(["Dedicated"]).levi; // Levi: 6 words
    const danOneWord = score(["Alert"]).dan; // Dan: more words
    expect(leviOneWord).toBeGreaterThan(danOneWord);
  });

  it("ignores unknown selections", () => {
    expect(score(["NotAWord"])).toEqual(score([]));
  });
});

describe("deriveResult", () => {
  it("always returns a Primary, even with all-zero scores", () => {
    const result = deriveResult(makeScores({}));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("picks the highest-scoring tribe as Primary", () => {
    const result = deriveResult(makeScores({ dan: 0.9, asher: 0.2 }));
    expect(result.primary).toBe("dan");
  });

  it("returns a Secondary when it is near Primary and ahead of the third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.9, simeon: 0.5 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.6, simeon: 0.3 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.85, simeon: 0.84 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("breaks ties deterministically by tribe number", () => {
    // Judah (#1) and Levi (#2) tie; Judah wins on the lower number.
    const result = deriveResult(makeScores({ judah: 0.5, levi: 0.5 }));
    expect(result.primary).toBe("judah");
  });
});
