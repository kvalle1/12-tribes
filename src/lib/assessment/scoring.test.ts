import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { WORDS } from "./words";
import { score, deriveResult, type TribeScores } from "./scoring";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Build a full score map from a partial one, defaulting every other tribe to 0. */
const makeScores = (partial: Record<string, number>): TribeScores => {
  const scores: TribeScores = {};
  for (const t of tribes) scores[t.slug] = partial[t.slug] ?? 0;
  return scores;
};

describe("score", () => {
  it("returns a normalized 0–1 value for every tribe", () => {
    const scores = score(["Courageous"]);
    expect(Object.keys(scores).sort()).toEqual(tribes.map((t) => t.slug).sort());
    for (const slug of Object.keys(scores)) {
      expect(scores[slug]).toBeGreaterThanOrEqual(0);
      expect(scores[slug]).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero for an empty selection", () => {
    const scores = score([]);
    for (const t of tribes) expect(scores[t.slug]).toBe(0);
  });

  it("ignores words that are not in the list", () => {
    // Unknown or wrong-case strings contribute nothing (exact-match contract).
    expect(score(["notaword", "courageous"]).judah).toBe(0);
  });

  it("deduplicates repeated selections", () => {
    expect(score(["Courageous", "Courageous"]).judah).toBe(
      score(["Courageous"]).judah,
    );
  });

  it("splits a two-tribe shared word 0.5 to each tribe", () => {
    // "Courageous" is judah-only (full point); "Bold" is judah+reuben (half).
    // Normalized by the same judah denominator, the shared word is worth half.
    const full = score(["Courageous"]).judah;
    const shared = score(["Bold"]).judah;
    expect(shared).toBeGreaterThan(0);
    expect(full).toBeCloseTo(2 * shared);

    // The shared word also lands on reuben, and on nobody else.
    const bold = score(["Bold"]);
    expect(bold.reuben).toBeGreaterThan(0);
    expect(bold.levi).toBe(0);
  });

  it("splits the three-tribe word evenly (1/3 each)", () => {
    const full = score(["Courageous"]).judah; // judah earns a full point
    const third = score(["Zealous"]).judah; // judah earns 1/3 of a point
    expect(full).toBeCloseTo(3 * third);
  });

  it("normalizes by each tribe's coverage so full coverage scores 1.0 regardless of word count", () => {
    // Levi has 6 words, Issachar 10 — selecting all of a tribe's words yields a
    // perfect 1.0 for that tribe either way (coverage-fair, ADR-0001).
    expect(score(wordsForTribe("levi")).levi).toBeCloseTo(1);
    expect(score(wordsForTribe("issachar")).issachar).toBeCloseTo(1);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary, even for an all-zero score map", () => {
    const result = deriveResult(makeScores({}));
    // Deterministic tie-break by tribe number → Judah (#1) wins on an all-zero map.
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.9, levi: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("reuben");
  });

  it("includes the Secondary exactly at the 80% boundary", () => {
    // second is exactly 20% below primary, third clearly behind → qualifies.
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.8, levi: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("reuben");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.5, levi: 0.1 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.9, levi: 0.85 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("breaks ranking ties deterministically by tribe number", () => {
    // judah (#1) and benjamin (#6) tie; judah wins primary by lower number.
    const result = deriveResult(makeScores({ judah: 0.8, benjamin: 0.8 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("composes with score() end to end", () => {
    // A selection dominated by Levi words should resolve Levi as Primary.
    const scores = score([...wordsForTribe("levi"), "Courageous"]);
    expect(deriveResult(scores).primary).toBe("levi");
  });
});
