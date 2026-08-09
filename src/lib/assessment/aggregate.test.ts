import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero with no observers, and reports a zero count", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("with a single observer, equals that observer's own normalized scores", () => {
    const words = [...wordsForTribe("judah"), ...wordsForTribe("levi")];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    expect(agg.observerCount).toBe(1);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // Two observers see the same tribe fully, a third sees a different one.
    // Equal-weight: levi is seen by 2 of 3 observers ⇒ 2/3; issachar by 1 ⇒ 1/3.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(2 / 3);
    expect(scoreFor("issachar", agg.scores)).toBeCloseTo(1 / 3);
    // A pooled "bag of words" would union the selections and score once,
    // tying levi and issachar at 1.0 — equal-weight must keep levi ahead.
    expect(scoreFor("levi", agg.scores)).toBeGreaterThan(
      scoreFor("issachar", agg.scores),
    );
  });

  it("does not let a wordier observer gain more influence", () => {
    // Issachar has 10 words, Levi 6. Each observer fully covers one tribe, so
    // each contributes a normalized 1.0 for their tribe — the extra words the
    // Issachar observer picked must not tilt the average toward issachar.
    const agg = aggregateObservers([
      wordsForTribe("issachar"),
      wordsForTribe("levi"),
    ]);
    expect(scoreFor("issachar", agg.scores)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(0.5);
  });

  it("exposes each observer's own normalized scores in input order", () => {
    const first = wordsForTribe("judah");
    const second = wordsForTribe("issachar");
    const agg = aggregateObservers([first, second]);
    expect(agg.perObserver).toHaveLength(2);
    expect(scoreFor("judah", agg.perObserver[0])).toBeCloseTo(
      scoreFor("judah", score(first)),
    );
    expect(scoreFor("issachar", agg.perObserver[1])).toBeCloseTo(
      scoreFor("issachar", score(second)),
    );
    // Anonymity: perObserver carries only scores, positionally — no identity.
    expect(agg.perObserver[0].map((s) => s.slug)).toEqual(
      tribes.map((t) => t.slug),
    );
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 1)).toBe(true);
  });

  it("requires at least 3 observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
