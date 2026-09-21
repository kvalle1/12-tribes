import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS } from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** A response is just its selected words (observers are anonymous, ADR-0003). */
const from = (...words: string[]) => ({ words });

describe("aggregateObservers", () => {
  it("returns an all-zero 12-tribe profile and no observers for an empty set", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("for a single observer, the aggregate is exactly that observer's own normalized score", () => {
    const words = ["Courageous", "Dedicated"];
    const own = score(words);
    const agg = aggregateObservers([{ words }]);

    expect(agg.observerCount).toBe(1);
    expect(agg.perObserver).toHaveLength(1);
    for (const t of tribes) {
      expect(scoreFor(t.slug, agg.scores)).toBeCloseTo(scoreFor(t.slug, own));
      expect(scoreFor(t.slug, agg.perObserver[0])).toBeCloseTo(
        scoreFor(t.slug, own),
      );
    }
  });

  it("is the equal-weight average of each observer's individually-normalized scores", () => {
    const a = ["Courageous"]; // judah
    const b = ["Dedicated"]; // levi
    const c = ["Analytical"]; // issachar
    const agg = aggregateObservers([from(...a), from(...b), from(...c)]);

    for (const t of tribes) {
      const mean =
        (scoreFor(t.slug, score(a)) +
          scoreFor(t.slug, score(b)) +
          scoreFor(t.slug, score(c))) /
        3;
      expect(scoreFor(t.slug, agg.scores)).toBeCloseTo(mean);
    }
  });

  it("weights each observer equally regardless of word count (not a pooled bag of words)", () => {
    // One observer leans hard on Judah with three words; the other picks a
    // single Levi word. Pooling the words would let the wordier observer
    // dominate; equal-weight averaging must not.
    const heavy = ["Courageous", "Authoritative", "Bold"]; // Judah-heavy
    const light = ["Dedicated"]; // Levi
    const agg = aggregateObservers([from(...heavy), from(...light)]);

    const meanJudah =
      (scoreFor("judah", score(heavy)) + scoreFor("judah", score(light))) / 2;
    expect(scoreFor("judah", agg.scores)).toBeCloseTo(meanJudah);

    // A pooled score (all words scored as one selection) over-counts the wordier
    // observer, so the equal-weight aggregate must differ from it.
    const pooledJudah = scoreFor("judah", score([...heavy, ...light]));
    expect(scoreFor("judah", agg.scores)).not.toBeCloseTo(pooledJudah);
  });

  it("keeps the per-observer drill-down anonymous, ordered, and full-width (12 tribes each)", () => {
    const agg = aggregateObservers([
      from("Courageous"), // Observer 1 → Judah
      from("Dedicated"), // Observer 2 → Levi
      from("Analytical"), // Observer 3 → Issachar
    ]);

    expect(agg.perObserver).toHaveLength(3);
    for (const vec of agg.perObserver) {
      expect(vec.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Order is preserved: Observer 1 is the Judah pick, and carries no Levi signal.
    expect(scoreFor("judah", agg.perObserver[0])).toBeGreaterThan(0);
    expect(scoreFor("levi", agg.perObserver[0])).toBe(0);
  });

  it("unlocks only once at least MIN_OBSERVERS have responded", () => {
    expect(MIN_OBSERVERS).toBe(3);
    const many = (n: number) =>
      Array.from({ length: n }, () => from("Courageous"));

    expect(aggregateObservers(many(1)).unlocked).toBe(false);
    expect(aggregateObservers(many(2)).unlocked).toBe(false);
    expect(aggregateObservers(many(3)).unlocked).toBe(true);
    expect(aggregateObservers(many(5)).unlocked).toBe(true);
  });
});
