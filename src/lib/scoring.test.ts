import { describe, expect, it } from "vitest";
import { tribes } from "./tribes";
import { words } from "./words";
import { deriveResult, score, type ScoreMap } from "./scoring";

/** All words that map to a given tribe slug. */
function wordsFor(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

/** A zeroed score map with the given slugs overridden. */
function scoreMap(overrides: Record<string, number>): ScoreMap {
  const map: ScoreMap = {};
  for (const t of tribes) map[t.slug] = 0;
  return { ...map, ...overrides };
}

describe("score", () => {
  it("returns a value in [0, 1] for every tribe", () => {
    const scores = score(["Bold", "Wise", "Loyal", "Healing"]);
    for (const t of tribes) {
      expect(scores[t.slug]).toBeGreaterThanOrEqual(0);
      expect(scores[t.slug]).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(scores).sort()).toEqual(tribes.map((t) => t.slug).sort());
  });

  it("scores zero for every tribe when nothing is selected", () => {
    const scores = score([]);
    for (const t of tribes) expect(scores[t.slug]).toBe(0);
  });

  it("splits a shared word as half of a sole word for the same tribe", () => {
    // Reuben: 'Energetic' is sole (1.0), 'Bold' is shared judah/reuben (0.5).
    // After normalization by Reuben's available points, the sole word must
    // contribute exactly twice what the shared word does.
    const sole = score(["Energetic"]).reuben;
    const shared = score(["Bold"]).reuben;
    expect(sole).toBeGreaterThan(0);
    expect(shared).toBeGreaterThan(0);
    expect(sole).toBeCloseTo(2 * shared, 10);
  });

  it("gives both tribes of a shared word equal credit", () => {
    // 'Generous' is shared zebulun/asher; each gets 0.5 of its own available.
    const z = score(["Generous"]).zebulun;
    const a = score(["Generous"]).asher;
    expect(z).toBeGreaterThan(0);
    expect(a).toBeGreaterThan(0);
  });

  it("normalizes fairly across coverage: selecting all of a tribe's words scores 1.0", () => {
    // Levi (6 words) and Dan (10 words) must both reach a full 1.0 when all
    // their words are picked — coverage must not advantage the larger tribe.
    expect(score(wordsFor("levi")).levi).toBeCloseTo(1, 10);
    expect(score(wordsFor("dan")).dan).toBeCloseTo(1, 10);
  });

  it("ignores unknown words", () => {
    expect(score(["__nope__"]).judah).toBe(0);
  });

  it("does not double-count a word selected twice", () => {
    expect(score(["Courageous", "Courageous"]).judah).toBe(score(["Courageous"]).judah);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary, even with an all-zero map", () => {
    const result = deriveResult(scoreMap({}));
    expect(result.primary).toBeTruthy();
    expect(tribes.some((t) => t.slug === result.primary)).toBe(true);
  });

  it("picks the highest-scoring tribe as Primary", () => {
    const result = deriveResult(scoreMap({ judah: 0.9, dan: 0.4 }));
    expect(result.primary).toBe("judah");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(scoreMap({ judah: 1.0, dan: 0.9, levi: 0.5 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(scoreMap({ judah: 1.0, dan: 0.5, levi: 0.4 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(scoreMap({ judah: 1.0, dan: 0.9, levi: 0.85 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when the map is all zero", () => {
    expect(deriveResult(scoreMap({})).secondary).toBeNull();
  });
});
