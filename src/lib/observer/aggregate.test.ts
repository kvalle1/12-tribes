import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreOf = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a 12-tribe others profile in canonical order", () => {
    const agg = aggregateObservers([
      { words: ["Courageous"] },
      { words: ["Bold"] },
      { words: ["Zealous"] },
    ]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("averages the per-observer normalized profiles with equal weight", () => {
    const a = score(["Courageous"]);
    const b = score(["Bold"]);
    const agg = aggregateObservers([{ words: ["Courageous"] }, { words: ["Bold"] }]);

    agg.others.forEach((row, i) => {
      expect(row.score).toBeCloseTo((a[i].score + b[i].score) / 2);
    });
  });

  it("counts each observer equally regardless of how many words they picked", () => {
    // One observer picks a single word, the other picks a whole tribe's worth —
    // each still contributes exactly half of the average (equal weight, ADR-0003,
    // PRD story 25). If word count leaked into influence, this mean would not hold.
    const few = ["Courageous"];
    const many = wordsForTribe("levi");
    const a = score(few);
    const b = score(many);
    const agg = aggregateObservers([{ words: few }, { words: many }]);

    agg.others.forEach((row, i) => {
      expect(row.score).toBeCloseTo((a[i].score + b[i].score) / 2);
    });
  });

  it("averages per-observer profiles rather than pooling words into one bag", () => {
    // Pooling both observers' words into one selection and scoring once gives a
    // different (word-count-weighted) answer than the equal-weight per-observer
    // average. The aggregate must match the average, not the pooled bag.
    const agg = aggregateObservers([{ words: ["Courageous"] }, { words: ["Bold"] }]);
    const pooled = score(["Courageous", "Bold"]);
    const averaged = (score(["Courageous"])[0].score + score(["Bold"])[0].score) / 2;

    // judah (#1) is the first tribe in canonical order.
    expect(scoreOf("judah", agg.others)).toBeCloseTo(averaged);
    expect(scoreOf("judah", agg.others)).not.toBeCloseTo(
      scoreOf("judah", pooled),
    );
  });

  it("exposes each observer's individual normalized profile for drill-down", () => {
    const agg = aggregateObservers([{ words: ["Courageous"] }, { words: ["Bold"] }]);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(["Courageous"]));
    expect(agg.perObserver[1]).toEqual(score(["Bold"]));
  });

  it("reports the observer count", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([{ words: ["Courageous"] }, { words: ["Bold"] }])
        .observerCount,
    ).toBe(2);
  });

  it("locks below the unlock threshold and unlocks at it", () => {
    const one = { words: ["Courageous"] };
    expect(aggregateObservers([]).unlocked).toBe(false);
    expect(aggregateObservers([one, one]).unlocked).toBe(false);
    expect(aggregateObservers([one, one, one]).unlocked).toBe(true);
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });

  it("handles no responses without dividing by zero", () => {
    const agg = aggregateObservers([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });
});
