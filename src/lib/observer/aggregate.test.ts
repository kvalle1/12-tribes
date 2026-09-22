import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, scoreEachObserver } from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([wordsForTribe("levi")]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero when there are no observers", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized profile for one response", () => {
    const words = wordsForTribe("dan");
    const others = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("dan");
    const others = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("counts each observer equally regardless of how many words they picked", () => {
    // Levi has 6 mapped words, Issachar 10. One observer selects all of Levi's
    // words (Levi 1.0), another all of Issachar's (Issachar 1.0). Equal-weight
    // averaging lands both at 0.5 — the observer who picked more words does not
    // gain more influence (ADR-0003, PRD story 25).
    const leviObserver = wordsForTribe("levi");
    const issacharObserver = wordsForTribe("issachar");
    const others = aggregateObservers([leviObserver, issacharObserver]);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
  });

  it("is the average of individual profiles, not a pooled bag of words", () => {
    // Pooling both observers' words into one selection scores each tribe to its
    // own full 1.0, erasing the equal-weight split. The aggregate must differ:
    // 0.5/0.5, not 1.0/1.0.
    const leviObserver = wordsForTribe("levi");
    const issacharObserver = wordsForTribe("issachar");
    const others = aggregateObservers([leviObserver, issacharObserver]);
    const pooled = score([...leviObserver, ...issacharObserver]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", others)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );
  });
});

describe("scoreEachObserver", () => {
  it("returns one normalized profile per observer, in input order", () => {
    const responses = [wordsForTribe("judah"), wordsForTribe("dan")];
    const perObserver = scoreEachObserver(responses);
    expect(perObserver).toHaveLength(2);
    for (let i = 0; i < responses.length; i++) {
      const expected = score(responses[i]);
      for (const tribe of tribes) {
        expect(scoreFor(tribe.slug, perObserver[i])).toBeCloseTo(
          scoreFor(tribe.slug, expected),
        );
      }
    }
  });

  it("returns an empty list when there are no observers", () => {
    expect(scoreEachObserver([])).toEqual([]);
  });
});
