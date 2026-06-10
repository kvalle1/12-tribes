import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, deriveResult, type TribeScores } from "./scoring";

/** Build a full 12-tribe score record from a sparse override map. */
function makeScores(overrides: Record<string, number>): TribeScores {
  const out: TribeScores = {};
  for (const t of tribes) out[t.slug] = 0;
  return { ...out, ...overrides };
}

/** All words that map to a given tribe slug. */
function wordsFor(slug: string): string[] {
  return WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score()", () => {
  it("returns a 0–1 value for every one of the 12 tribes", () => {
    const s = score(["Bold"]);
    expect(Object.keys(s).sort()).toEqual(tribes.map((t) => t.slug).sort());
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word as 0.5 to each tribe (half a sole word)", () => {
    // "Generous" -> zebulun + asher (shared); "Enterprising" -> zebulun (sole).
    // Same tribe, same denominator: the shared word earns exactly half.
    const shared = score(["Generous"]).zebulun;
    const sole = score(["Enterprising"]).zebulun;
    expect(shared).toBeCloseTo(0.5 * sole, 10);
    expect(shared).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points (full coverage scores 1.0)", () => {
    // A small-coverage tribe and a large-coverage tribe both reach 1.0 when all
    // their words are selected — they compete fairly despite uneven coverage.
    const small = "simeon";
    const large = "issachar";
    expect(wordsFor(large).length).toBeGreaterThan(wordsFor(small).length);
    expect(score(wordsFor(small))[small]).toBeCloseTo(1, 10);
    expect(score(wordsFor(large))[large]).toBeCloseTo(1, 10);
  });

  it("scores a tribe as the fraction of its available points earned", () => {
    // One sole-mapped word out of all the tribe's words = 1 / availablePoints.
    const denom = WORDS.filter((w) => w.tribes.includes("issachar")).reduce(
      (sum, w) => sum + (w.tribes.length === 1 ? 1 : 0.5),
      0,
    );
    // "Analytical" is issachar-only (weight 1).
    expect(score(["Analytical"]).issachar).toBeCloseTo(1 / denom, 10);
  });

  it("ignores words that are not in the list and treats an empty selection as all-zero", () => {
    expect(score(["Flobble"]).judah).toBe(0);
    for (const v of Object.values(score([]))) expect(v).toBe(0);
  });

  it("counts a duplicated selection only once", () => {
    expect(score(["Bold", "Bold"]).judah).toBeCloseTo(score(["Bold"]).judah, 10);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary, even for an all-zero score", () => {
    const r = deriveResult(makeScores({}));
    expect(r.primary).toBeTruthy();
    expect(r.secondary).toBeUndefined();
  });

  it("returns the highest-scoring tribe as Primary", () => {
    const r = deriveResult(makeScores({ judah: 0.3, dan: 0.9, asher: 0.2 }));
    expect(r.primary).toBe("dan");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const r = deriveResult(
      makeScores({ judah: 1.0, levi: 0.9, dan: 0.5 }),
    );
    expect(r.primary).toBe("judah");
    expect(r.secondary).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const r = deriveResult(makeScores({ judah: 1.0, levi: 0.5, dan: 0.4 }));
    expect(r.primary).toBe("judah");
    expect(r.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const r = deriveResult(makeScores({ judah: 1.0, levi: 0.9, dan: 0.85 }));
    expect(r.primary).toBe("judah");
    expect(r.secondary).toBeUndefined();
  });
});
