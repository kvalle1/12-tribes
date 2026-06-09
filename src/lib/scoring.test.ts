import { describe, expect, it } from "vitest";

import { tribes } from "./tribes";
import { words } from "./words";
import { deriveResult, score, type Scores } from "./scoring";

/** All words that map to a given tribe slug. */
function wordsFor(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

/** Build a full 12-tribe score record, defaulting unmentioned tribes to 0. */
function makeScores(partial: Scores): Scores {
  const scores: Scores = {};
  for (const t of tribes) scores[t.slug] = partial[t.slug] ?? 0;
  return scores;
}

describe("score", () => {
  it("returns a normalized 0–1 value for every one of the 12 tribes", () => {
    const scores = score(["Bold", "Wise", "Loyal", "Steady"]);
    expect(Object.keys(scores).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each tribe (half a solo word's weight)", () => {
    // "Bold" is shared (Judah · Reuben); "Authoritative" is solo Judah.
    const solo = score(["Authoritative"]).judah;
    const shared = score(["Bold"]).judah;

    expect(shared).toBeGreaterThan(0);
    expect(solo / shared).toBeCloseTo(2); // shared contributes half the points
    // and the shared word also lands on its second tribe
    expect(score(["Bold"]).reuben).toBeGreaterThan(0);
  });

  it("normalizes by available points so low- and high-coverage tribes compete fairly", () => {
    // Levi (6 words) and Dan (10 words) both top out at 1.0 when fully selected.
    expect(score(wordsFor("levi")).levi).toBeCloseTo(1);
    expect(score(wordsFor("dan")).dan).toBeCloseTo(1);

    // Selecting one solo word for a small tribe should not beat the same for a
    // large tribe purely on word count — normalization keeps it proportional.
    const leviOne = score(["Dedicated"]).levi; // 1 / Levi's available
    const danOne = score(["Alert"]).dan; // 1 / Dan's available
    expect(leviOne).toBeGreaterThan(danOne); // Levi has fewer available points
    expect(leviOne).toBeLessThanOrEqual(1);
  });

  it("ignores unknown words and counts duplicates once", () => {
    expect(score(["definitely-not-a-word"]).judah).toBe(0);
    expect(score(["Authoritative", "Authoritative"]).judah).toBeCloseTo(
      score(["Authoritative"]).judah,
    );
  });
});

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(makeScores({ judah: 0.4, dan: 0.9, levi: 0.2 }));
    expect(result.primary.slug).toBe("dan");
    expect(result.ranked[0].slug).toBe("dan");
    expect(result.ranked).toHaveLength(tribes.length);
  });

  it("returns a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.85, levi: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.5, levi: 0.4 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.85, levi: 0.82 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("breaks score ties deterministically by tribe number", () => {
    // Judah (#1) and Simeon (#12) tie; Judah wins the tie-break.
    const result = deriveResult(makeScores({ judah: 0.5, simeon: 0.5 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("works end-to-end from a real word selection", () => {
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
