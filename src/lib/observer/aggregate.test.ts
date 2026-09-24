import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import { aggregateObservers } from "./aggregate";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("yields an all-zero profile when there are no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals that observer's own profile for a single response", () => {
    const words = ["Courageous", "Bold"];
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("averages two observers per tribe (arithmetic mean of their profiles)", () => {
    const a = ["Courageous"]; // judah-only
    const b = ["Dedicated"]; // levi-only
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
    // Sanity: both single-tribe picks land at exactly half their solo score.
    expect(scoreFor("judah", agg)).toBeCloseTo(scoreFor("judah", sa) / 2);
    expect(scoreFor("levi", agg)).toBeCloseTo(scoreFor("levi", sb) / 2);
  });

  it("gives each observer equal weight regardless of how many words they pick", () => {
    // Observer A covers ALL of Levi's words (a big, word-heavy selection);
    // Observer B picks a single Judah word. Equal-weight averaging must treat
    // them as one vote each — Levi lands at ~0.5 (1.0 averaged with 0), and A's
    // word count must not drown out B's single Judah pick.
    const observerA = wordsForTribe("levi"); // many words, full Levi coverage
    const observerB = ["Courageous"]; // one word, Judah
    const agg = aggregateObservers([observerA, observerB]);

    expect(scoreFor("levi", agg)).toBeCloseTo(1 / 2);
    expect(scoreFor("judah", agg)).toBeCloseTo(
      scoreFor("judah", score(observerB)) / 2,
    );

    // And it is genuinely NOT a pooled bag of words: pooling both observers'
    // words into one selection lets Observer A's full Levi coverage stand at
    // 1.0, while equal-weight averaging halves it to 0.5 because A is only one
    // of two voters. That gap is exactly the word-heavy observer being reined
    // in.
    const pooled = score([...observerA, ...observerB]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", pooled)).toBeGreaterThan(scoreFor("levi", agg));
  });

  it("keeps every tribe score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      ["Creative", "Enterprising"],
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});
