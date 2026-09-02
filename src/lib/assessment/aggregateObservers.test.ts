import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a normalized score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("levi")]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.observerCount).toBe(1);
  });

  it("averages each observer's normalized score with equal weight", () => {
    // The defining property (ADR-0003): the aggregate is the mean of each
    // observer's *individually normalized* score, tribe by tribe.
    const responses = [
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
      ["Courageous", "Bold", "Zealous"],
    ];
    const agg = aggregateObservers(responses);

    for (let i = 0; i < tribes.length; i++) {
      const mean =
        responses.reduce((sum, r) => sum + score(r)[i].score, 0) /
        responses.length;
      expect(agg.scores[i].score).toBeCloseTo(mean);
    }
  });

  it("weights each observer equally regardless of how many words they picked", () => {
    // issachar has 10 words, levi has 6 — the observer who picks more words must
    // not gain more pull. Each contributes exactly half of the aggregate.
    const many = wordsForTribe("issachar");
    const few = wordsForTribe("levi");
    const agg = aggregateObservers([many, few]);

    const selfMany = score(many);
    const selfFew = score(few);

    expect(scoreFor("issachar", agg.scores)).toBeCloseTo(
      (scoreFor("issachar", selfMany) + scoreFor("issachar", selfFew)) / 2,
    );
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(
      (scoreFor("levi", selfMany) + scoreFor("levi", selfFew)) / 2,
    );
  });

  it("is an average of normalized scores, not a re-score of the pooled words", () => {
    // Pooling all observers' words into one score lets the bigger pile dominate;
    // equal-weight averaging does not. Here pooling gives issachar full coverage
    // (1.0), while the average must be strictly less because the second observer
    // (levi's words) cannot fully cover issachar.
    const many = wordsForTribe("issachar");
    const few = wordsForTribe("levi");

    const agg = aggregateObservers([many, few]);
    const pooled = score([...many, ...few]);

    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", agg.scores)).toBeLessThan(
      scoreFor("issachar", pooled),
    );
  });

  it("exposes each observer's own scores for anonymous drill-down", () => {
    const responses = [
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
      wordsForTribe("judah"),
    ];
    const agg = aggregateObservers(responses);

    expect(agg.perObserver).toHaveLength(3);
    for (let i = 0; i < responses.length; i++) {
      // Each drill-down profile is exactly that observer's own normalized score…
      expect(agg.perObserver[i]).toEqual(score(responses[i]));
      // …and carries only tribe scores — no observer identity or attributes.
      expect(Object.keys(agg.perObserver[i][0]).sort()).toEqual([
        "name",
        "score",
        "slug",
      ]);
    }
  });

  it("handles no observer responses as an all-zero, empty aggregate", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });
});

describe("isReportUnlocked", () => {
  it(`locks the report below ${MIN_OBSERVERS} observers`, () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
  });

  it(`unlocks the report at ${MIN_OBSERVERS} observers and above`, () => {
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});
