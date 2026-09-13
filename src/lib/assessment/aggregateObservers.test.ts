import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  scoreEachObserver,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregateObservers";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

// A concrete, mixed set of Observer responses used across several cases. Word
// lists are deliberately different lengths so "equal weight regardless of how
// many words an Observer picks" is exercised, not assumed.
const judahWords = wordsForTribe("judah");
const leviWords = wordsForTribe("levi");
const issacharWords = wordsForTribe("issachar");

describe("aggregateObservers", () => {
  it("returns a score for every tribe in canonical order", () => {
    const others = aggregateObservers([judahWords, leviWords, issacharWords]);
    expect(others).toHaveLength(12);
    expect(others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns an all-zero profile for no observers (no divide-by-zero)", () => {
    const others = aggregateObservers([]);
    expect(others).toHaveLength(12);
    expect(others.every((t) => t.score === 0)).toBe(true);
  });

  it("is the equal-weight average of each observer's normalized score (the core identity)", () => {
    const responses = [judahWords, leviWords, issacharWords];
    const perObserver = responses.map((words) => score(words));
    const others = aggregateObservers(responses);

    for (const tribe of tribes) {
      const expected =
        perObserver.reduce((sum, obs) => sum + scoreFor(tribe.slug, obs), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected, 10);
    }
  });

  it("averages per-observer normalized scores rather than pooling all words into one bag", () => {
    // Two observers who both describe a Judah-leaning subject, but one is far
    // wordier. Pooling their words and scoring once would let the combined bag
    // saturate Judah near 1.0; equal-weight averaging keeps each observer's
    // individually-normalized read as one vote.
    const sparse = ["Bold", "Courageous"]; // small Judah-leaning read
    const rich = judahWords; // a full Judah read

    const averaged = scoreFor("judah", aggregateObservers([sparse, rich]));
    const pooled = scoreFor("judah", score([...sparse, ...rich]));

    const sparseSelf = scoreFor("judah", score(sparse));
    const richSelf = scoreFor("judah", score(rich));

    expect(averaged).toBeCloseTo((sparseSelf + richSelf) / 2, 10);
    // The averaged read is strictly below the pooled read — pooling is not used.
    expect(averaged).toBeLessThan(pooled);
  });

  it("does not let a wordier observer dominate a tribe only a sparse observer named", () => {
    // Observer A pours many words across many tribes but never touches Simeon.
    // Observer B is short but names Simeon strongly. Because each observer is
    // one equal vote, B's Simeon read is not drowned out by A's word count.
    const wordyElsewhere = [
      ...wordsForTribe("asher"),
      ...wordsForTribe("zebulun"),
    ];
    const sparseSimeon = wordsForTribe("simeon");

    const others = aggregateObservers([wordyElsewhere, sparseSimeon]);
    const simeonSelfSparse = scoreFor("simeon", score(sparseSimeon));

    // Simeon's aggregate is exactly half of the one observer who named it —
    // the wordy observer added zero Simeon, and contributed no extra weight.
    expect(scoreFor("simeon", others)).toBeCloseTo(simeonSelfSparse / 2, 10);
  });

  it("gives two identical observers the same profile as one of them", () => {
    const one = aggregateObservers([judahWords]);
    const two = aggregateObservers([judahWords, judahWords]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, two)).toBeCloseTo(
        scoreFor(tribe.slug, one),
        10,
      );
    }
  });
});

describe("scoreEachObserver", () => {
  it("scores each observer independently, preserving order and canonical tribes", () => {
    const responses = [judahWords, leviWords];
    const perObserver = scoreEachObserver(responses);
    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(judahWords));
    expect(perObserver[1]).toEqual(score(leviWords));
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe and reports self−others divergence", () => {
    const self = score(judahWords);
    const others = aggregateObservers([leviWords, issacharWords, leviWords]);
    const comparison = compareProfiles(self, others);

    expect(comparison.map((c) => c.slug)).toEqual(tribes.map((t) => t.slug));
    for (const row of comparison) {
      expect(row.divergence).toBeCloseTo(row.selfScore - row.othersScore, 10);
    }
    // Judah: strong in self, absent in others → positive divergence.
    const judah = comparison.find((c) => c.slug === "judah")!;
    expect(judah.selfScore).toBeGreaterThan(0);
    expect(judah.othersScore).toBe(0);
    expect(judah.divergence).toBeGreaterThan(0);
  });
});

describe("isReportUnlocked", () => {
  it("locks below the minimum and unlocks at or above it", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
