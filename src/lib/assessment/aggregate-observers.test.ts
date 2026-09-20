import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { aggregateObservers } from "./aggregate-observers";
import { MIN_OBSERVERS, hasEnoughObservers } from "./constants";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 profile for all 12 tribes in canonical order", () => {
    const { others } = aggregateObservers([
      ["Courageous"],
      wordsForTribe("levi"),
    ]);
    expect(others).toHaveLength(12);
    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
    for (const o of others) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(1);
    }
  });

  it("is all-zero with no observers, and reports a count of zero", () => {
    const { others, perObserver, count } = aggregateObservers([]);
    expect(count).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others.every((o) => o.score === 0)).toBe(true);
  });

  it("counts the observer responses it aggregated", () => {
    const { count } = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("judah"),
      wordsForTribe("dan"),
    ]);
    expect(count).toBe(3);
  });

  it("returns each observer's own normalized profile, anonymously, in order", () => {
    const a = wordsForTribe("levi");
    const b = wordsForTribe("issachar");
    const { perObserver } = aggregateObservers([a, b]);
    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(a));
    expect(perObserver[1]).toEqual(score(b));
  });

  it("for a single observer, the others profile equals that observer's own scores", () => {
    const words = wordsForTribe("judah");
    const { others } = aggregateObservers([words]);
    expect(others).toEqual(score(words));
  });

  it("is the equal-weight average of each observer's normalized scores", () => {
    // The core invariant (ADR-0003): score each observer individually, then
    // average the normalized profiles — every tribe's "others" score is the mean
    // of that tribe's per-observer scores.
    const a = ["Courageous", "Bold"];
    const b = wordsForTribe("levi");
    const sa = score(a);
    const sb = score(b);

    const { others } = aggregateObservers([a, b]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("weights every observer equally regardless of how many words they picked (not a pooled bag)", () => {
    // A word-heavy observer fully describing issachar, and a word-light observer
    // picking a single judah word. Each observer must count once: the heavy
    // observer's issachar read contributes exactly half. A pooled bag of words
    // would instead let the 11-word observer swamp the 1-word observer, keeping
    // issachar maxed.
    const heavy = wordsForTribe("issachar"); // full coverage → issachar 1.0 for them
    const light = ["Courageous"]; // one judah word
    expect(heavy.length).toBeGreaterThan(light.length); // genuinely uneven

    const { others } = aggregateObservers([heavy, light]);
    const pooled = score([...heavy, ...light]);

    // Equal weight: the word-heavy observer contributes exactly half.
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
    // A pooled bag would let those 11 words dominate — issachar stays maxed.
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    // So the equal-weight aggregate is materially below the pooled bag.
    expect(scoreFor("issachar", others)).toBeLessThan(
      scoreFor("issachar", pooled),
    );
  });

  it("does not mutate the input responses", () => {
    const a = ["Courageous"];
    const responses = [a];
    aggregateObservers(responses);
    expect(responses).toEqual([["Courageous"]]);
    expect(a).toEqual(["Courageous"]);
  });
});

describe("hasEnoughObservers (report unlock threshold)", () => {
  it("locks the report below the minimum observer count", () => {
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks the report at or above the minimum observer count", () => {
    expect(hasEnoughObservers(MIN_OBSERVERS)).toBe(true);
    expect(hasEnoughObservers(MIN_OBSERVERS + 1)).toBe(true);
  });

  it("requires at least three observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
