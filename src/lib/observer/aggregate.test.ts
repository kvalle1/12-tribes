import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

/** All words that map to a given tribe slug (same helper the score tests use). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero 'others' profile in canonical order for no observers", () => {
    const { others, perObserver, count } = aggregateObservers([]);
    expect(count).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((t) => t.score === 0)).toBe(true);
  });

  it("returns a single observer's own normalized profile unchanged", () => {
    const words = wordsForTribe("levi");
    const { others, perObserver, count } = aggregateObservers([words]);
    expect(count).toBe(1);
    expect(perObserver).toHaveLength(1);
    // Averaging one observer is that observer's profile.
    expect(others).toEqual(score(words));
    expect(scoreFor("levi", others)).toBeCloseTo(1);
  });

  it("is the equal-weight average of per-observer normalized scores", () => {
    // Two observers, each fully covering a different tribe. Equal weight means
    // each contributes exactly half, so both tribes land at 0.5.
    const obs1 = wordsForTribe("levi"); // levi = 1.0
    const obs2 = wordsForTribe("issachar"); // issachar = 1.0
    const { others } = aggregateObservers([obs1, obs2]);

    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);

    // Elementwise, `others` equals the mean of the two individual profiles.
    const s1 = score(obs1);
    const s2 = score(obs2);
    for (const tribe of others) {
      const expected =
        (scoreFor(tribe.slug, s1) + scoreFor(tribe.slug, s2)) / 2;
      expect(tribe.score).toBeCloseTo(expected);
    }
  });

  it("gives every observer equal weight regardless of how many words they pick (not a pooled bag of words)", () => {
    // One observer picks a single judah word; the other fully covers levi with
    // many words. Equal-weight averaging must NOT let the many-word observer
    // dominate the way pooling all words into one score would.
    const light = ["Courageous"]; // judah-only single word
    const heavy = wordsForTribe("levi"); // levi = 1.0, many words
    const { others } = aggregateObservers([light, heavy]);

    // Equal weight: levi is averaged down to 0.5 (0 from the light observer, 1.0
    // from the heavy one), not pulled toward the many-word observer.
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);

    // Pooling the words into one score keeps levi at 1.0 — proving the aggregate
    // is the average of normalized profiles, not a pooled bag of words.
    const pooled = score([...light, ...heavy]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", others)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );

    // And the judah signal from the light observer is preserved at half weight.
    const judahSolo = scoreFor("judah", score(light));
    expect(scoreFor("judah", others)).toBeCloseTo(judahSolo / 2);
  });

  it("exposes each observer's normalized profile in submission order for anonymous drill-down", () => {
    const obs1 = wordsForTribe("levi");
    const obs2 = wordsForTribe("issachar");
    const { perObserver } = aggregateObservers([obs1, obs2]);

    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(obs1));
    expect(perObserver[1]).toEqual(score(obs2));
    // No identity travels with a per-observer profile — it is just tribe scores.
    expect(Object.keys(perObserver[0][0]).sort()).toEqual(["name", "score", "slug"]);
  });

  it("delegates word handling to the scoring core (unknown words ignored)", () => {
    const { others } = aggregateObservers([["notaword", "Courageous"]]);
    expect(others).toEqual(score(["notaword", "Courageous"]));
  });
});

describe("isReportUnlocked", () => {
  it("locks below the minimum observer threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer threshold", () => {
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });

  it("requires at least three observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
