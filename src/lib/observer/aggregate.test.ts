import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import { aggregateObservers, MIN_OBSERVERS } from "./aggregate";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero, locked aggregate for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
    expect(agg.others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer individually, preserving input order", () => {
    const a = ["Courageous"];
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
  });

  it("returns the equal-weight mean of per-observer normalized scores", () => {
    const a = ["Courageous"]; // judah-heavy
    const b = wordsForTribe("levi"); // full levi coverage
    const agg = aggregateObservers([a, b]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, score(a)) + scoreFor(tribe.slug, score(b))) / 2;
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(expected);
    }
  });

  it("averages normalized profiles, not a pooled bag of words (ADR-0003)", () => {
    // Two observers share one word (Courageous → judah) and each add one
    // distinct Levi word. Pooling would take the *union* of words — one judah
    // word and two levi words — and score it once, so the two separate glimpses
    // of Levi stack into a doubled Levi reading. Equal-weight averaging instead
    // scores each observer on their own (each reads a single Levi word) and
    // takes the mean, so "others" reflects one Levi word's worth, not two.
    const a = ["Courageous", "Devoted"]; // judah + levi
    const b = ["Courageous", "Exacting"]; // judah + a different levi word

    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    // Each observer individually reads one Levi word, so the equal-weight mean
    // is one Levi word's normalized score — strictly less than the pooled
    // reading, which sums both Levi words.
    expect(scoreFor("levi", agg.others)).toBeCloseTo(
      scoreFor("levi", score(["Devoted"])),
    );
    expect(scoreFor("levi", agg.others)).toBeLessThan(
      scoreFor("levi", pooled),
    );

    // The shared Judah word, by contrast, is one word either way: pooling
    // dedups it and the equal-weight mean of two identical Judah readings is the
    // same single value — so this dimension does not distinguish the two, and
    // must match.
    expect(scoreFor("judah", agg.others)).toBeCloseTo(
      scoreFor("judah", pooled),
    );
  });

  it("gives every observer equal influence regardless of word count", () => {
    // Two observers who both read the subject as pure Judah contribute the same
    // Judah vote even though one selected far more words than the other.
    const many = wordsForTribe("judah");
    const few = ["Courageous"]; // a single judah word
    const agg = aggregateObservers([many, few]);
    // Each observer's Judah score is 1.0 (many) and <1.0 (few); the average is
    // their simple mean — proving neither was up- or down-weighted by count.
    const expected =
      (scoreFor("judah", score(many)) + scoreFor("judah", score(few))) / 2;
    expect(scoreFor("judah", agg.others)).toBeCloseTo(expected);
  });

  it("stays locked below the observer threshold", () => {
    const one = aggregateObservers([["Courageous"]]);
    expect(one.observerCount).toBe(1);
    expect(one.unlocked).toBe(false);

    const two = aggregateObservers([["Courageous"], ["Devoted"]]);
    expect(two.observerCount).toBe(2);
    expect(two.unlocked).toBe(false);
  });

  it("unlocks at exactly the observer threshold and above", () => {
    const responses = Array.from({ length: MIN_OBSERVERS }, () => [
      "Courageous",
    ]);
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(MIN_OBSERVERS);
    expect(agg.unlocked).toBe(true);

    const more = aggregateObservers([...responses, ["Devoted"]]);
    expect(more.unlocked).toBe(true);
  });

  it("keeps every averaged tribe score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      ["Courageous", "Devoted"],
    ]);
    for (const t of agg.others) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(1);
    }
  });
});
