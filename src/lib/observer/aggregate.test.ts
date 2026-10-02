import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import {
  aggregateObservers,
  scorePerObserver,
  observersUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (
  slug: string,
  scores: readonly { slug: string; score: number }[],
) => scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([
      ["Courageous"],
      ["Bold"],
      ["Zealous"],
    ]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns an all-zero table for no observers (never divides by zero)", () => {
    const others = aggregateObservers([]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("with a single observer returns that observer's own normalized profile", () => {
    const words = wordsForTribe("judah").slice(0, 3);
    const others = aggregateObservers([words]);
    const self = score(words);
    for (const t of tribes) {
      expect(scoreFor(t.slug, others)).toBeCloseTo(scoreFor(t.slug, self));
    }
  });

  it("is the per-tribe arithmetic mean of each observer's normalized score", () => {
    const a = ["Courageous"];
    const b = ["Bold"];
    const others = aggregateObservers([a, b]);
    for (const t of tribes) {
      const expected =
        (scoreFor(t.slug, score(a)) + scoreFor(t.slug, score(b))) / 2;
      expect(scoreFor(t.slug, others)).toBeCloseTo(expected);
    }
  });

  it("averages equally — an observer who picks more words gains no extra influence", () => {
    // One observer selects *all* of Levi's words (Levi scores a perfect 1.0);
    // the other selects a single Judah word. Equal-weight averaging gives Levi
    // (1.0 + 0) / 2 = 0.5 — the large selection does not dominate.
    const leviFull = wordsForTribe("levi");
    const judahOne = ["Courageous"];

    const others = aggregateObservers([leviFull, judahOne]);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);

    // Contrast with *pooling* every word into one score, where the larger
    // selection keeps Levi maxed — the behavior this ADR-0003 choice rejects.
    const pooled = score([...leviFull, ...judahOne]);
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", others)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );
  });

  it("order of observers does not change the aggregate", () => {
    const a = wordsForTribe("judah").slice(0, 2);
    const b = wordsForTribe("levi").slice(0, 4);
    const c = ["Bold", "Zealous"];
    const forward = aggregateObservers([a, b, c]);
    const reversed = aggregateObservers([c, b, a]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, forward)).toBeCloseTo(scoreFor(t.slug, reversed));
    }
  });
});

describe("scorePerObserver", () => {
  it("scores each observer independently, one normalized table per observer", () => {
    const selections = [["Courageous"], ["Bold"], wordsForTribe("levi")];
    const per = scorePerObserver(selections);
    expect(per).toHaveLength(3);
    for (const table of per) {
      expect(table).toHaveLength(12);
      for (const s of table) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    }
    // Each observer's table equals scoring that selection on its own.
    expect(per[0]).toEqual(score(["Courageous"]));
    expect(per[1]).toEqual(score(["Bold"]));
  });

  it("returns an empty list for no observers", () => {
    expect(scorePerObserver([])).toEqual([]);
  });
});

describe("observersUnlocked", () => {
  it("unlocks only at the 3-observer threshold", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(observersUnlocked(0)).toBe(false);
    expect(observersUnlocked(1)).toBe(false);
    expect(observersUnlocked(2)).toBe(false);
    expect(observersUnlocked(3)).toBe(true);
    expect(observersUnlocked(5)).toBe(true);
  });
});
