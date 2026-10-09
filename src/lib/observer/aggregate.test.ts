import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, availablePointsByTribe, type TribeScore } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
  type ObserverResponse,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug — a maximal selection for that tribe. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const asResponses = (...wordLists: string[][]): ObserverResponse[] =>
  wordLists.map((words) => ({ words }));

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers(asResponses(["Courageous"]));
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.map((s) => s.name)).toEqual(tribes.map((t) => t.name));
  });

  it("scores all-zero with no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized score for one observer", () => {
    const words = wordsForTribe("levi");
    const agg = aggregateObservers(asResponses(words));
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("is the equal-weight average of per-observer normalized scores, not a pooled bag of words", () => {
    // Observer A picks many words (a whole tribe); Observer B picks a single
    // word. Equal-weight averaging must give each observer the same influence,
    // so the aggregate is the elementwise mean of their individual profiles —
    // NOT the score of all their words pooled into one selection (which would
    // let the wordier observer A dominate).
    const aWords = wordsForTribe("levi");
    const bWords = ["Courageous"];

    const agg = aggregateObservers(asResponses(aWords, bWords));
    const a = score(aWords);
    const b = score(bWords);
    const pooled = score([...aWords, ...bWords]);

    for (const tribe of tribes) {
      const expectedMean =
        (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expectedMean);
    }

    // And it is demonstrably different from pooling the words together.
    const pooledDiffersSomewhere = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, agg) - scoreFor(t.slug, pooled)) > 1e-9,
    );
    expect(pooledDiffersSomewhere).toBe(true);
  });

  it("gives a wordy observer no more influence than a terse one", () => {
    // Two observers disagree: A (wordy) reads the subject as Levi, B (terse)
    // as Judah. With equal weight neither tribe's average can exceed the mean
    // of the two individual normalized scores for it.
    const aWords = wordsForTribe("levi");
    const bWords = wordsForTribe("judah").slice(0, 1);

    const agg = aggregateObservers(asResponses(aWords, bWords));
    const a = score(aWords);
    const b = score(bWords);

    const levi = scoreFor("levi", agg);
    const judah = scoreFor("judah", agg);
    expect(levi).toBeCloseTo((scoreFor("levi", a) + scoreFor("levi", b)) / 2);
    expect(judah).toBeCloseTo(
      (scoreFor("judah", a) + scoreFor("judah", b)) / 2,
    );
  });

  it("keeps every tribe's averaged score within the normalized 0–1 range", () => {
    const agg = aggregateObservers(
      asResponses(
        wordsForTribe("levi"),
        wordsForTribe("judah"),
        wordsForTribe("issachar"),
        ["Courageous", "Bold"],
      ),
    );
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    // Sanity: available points exist for every tribe so no NaN crept in.
    expect(Object.keys(availablePointsByTribe)).toHaveLength(12);
    expect(agg.every((s) => Number.isFinite(s.score))).toBe(true);
  });

  it("ignores unknown words per observer (same exact-match contract as score)", () => {
    const withJunk = aggregateObservers(
      asResponses(["Courageous", "notaword"], ["notaword"]),
    );
    const clean = aggregateObservers(asResponses(["Courageous"], []));
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, withJunk)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });

  it("unlocks the comparison report at three observers", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
  });
});
