import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Manual equal-weight mean of per-observer normalized scores, per tribe. */
const meanPerTribe = (responses: string[][]): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const words of responses) {
    for (const s of score(words)) totals[s.slug] += s.score;
  }
  const n = responses.length || 1;
  for (const slug of Object.keys(totals)) totals[slug] /= n;
  return totals;
};

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous", "Bold"], ["Wise"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns all-zero scores when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own normalized score", () => {
    const words = [...wordsForTribe("judah"), "Wise"];
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const s of agg) {
      expect(s.score).toBeCloseTo(scoreFor(s.slug, self));
    }
  });

  it("is the equal-weight average of each observer's normalized score", () => {
    const responses = [
      [...wordsForTribe("judah")],
      [...wordsForTribe("levi"), "Wise"],
      ["Courageous", "Bold", "Wise", "Patient", "Steady", "Loyal", "Just", "Alert"],
    ];
    const agg = aggregateObservers(responses);
    const expected = meanPerTribe(responses);
    for (const s of agg) {
      expect(s.score).toBeCloseTo(expected[s.slug]);
    }
  });

  it("counts each observer equally, not as a pooled bag of words", () => {
    // One observer picks *every* Judah word (normalized Judah = 1.0); another
    // picks a single Judah word. Equal-weight averaging must land halfway
    // between the two — an observer who selects more words does not gain more
    // influence. Pooling the words instead would deduplicate to full Judah
    // coverage and report ~1.0, so this is the case that separates the two.
    const many = [...wordsForTribe("judah")];
    const few = ["Courageous"];
    const agg = aggregateObservers([many, few]);

    const expectedJudah =
      (scoreFor("judah", score(many)) + scoreFor("judah", score(few))) / 2;
    expect(scoreFor("judah", agg)).toBeCloseTo(expectedJudah);

    const pooled = score([...many, ...few]);
    expect(scoreFor("judah", agg)).toBeLessThan(scoreFor("judah", pooled));
  });

  it("gives identical observers their shared normalized score", () => {
    const words = ["Wise", "Patient", "Measured", "Learned", "Insightful", "Analytical", "Just", "Alert"];
    const agg = aggregateObservers([words, words, words]);
    const self = score(words);
    for (const s of agg) {
      expect(s.score).toBeCloseTo(scoreFor(s.slug, self));
    }
  });

  it("does not mutate its input", () => {
    const a = ["Courageous", "Bold"];
    const b = ["Wise"];
    const input = [a, b];
    aggregateObservers(input);
    expect(input).toEqual([["Courageous", "Bold"], ["Wise"]]);
  });

  it("unlocks the comparison report at 3 observers", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });
});
