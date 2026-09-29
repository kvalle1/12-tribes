import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero with no observers (locked-report safety)", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("keeps every tribe's average within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      wordsForTribe("judah"),
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("with a single observer equals that observer's own normalized score", () => {
    const words = [...wordsForTribe("issachar").slice(0, 3), "Courageous"];
    const agg = aggregateObservers([words]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("is the equal-weight per-tribe mean of the individual scores", () => {
    const a = [...wordsForTribe("levi")];
    const b = ["Courageous", "Bold", "Zealous"];
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const mean =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("normalizes each observer first, so it is NOT a pooled bag of words", () => {
    // Observer A picks a single Levi word; Observer B picks that same word plus
    // another Levi word (a superset). Pooling would dedupe to B's set and score
    // Levi once; equal-weight averaging must sit strictly between A and B.
    const levi = wordsForTribe("levi");
    const a = [levi[0]];
    const b = [levi[0], levi[1]];
    const sA = scoreFor("levi", score(a));
    const sB = scoreFor("levi", score(b));
    expect(sB).toBeGreaterThan(sA); // the extra word adds Levi evidence

    const agg = aggregateObservers([a, b]);
    expect(scoreFor("levi", agg)).toBeCloseTo((sA + sB) / 2);
    // A pooled score would just be B's score (union of words); the average is lower.
    const pooled = scoreFor("levi", score([...a, ...b]));
    expect(pooled).toBeCloseTo(sB);
    expect(scoreFor("levi", agg)).toBeLessThan(pooled);
  });

  it("gives a prolific observer no more influence than a terse one", () => {
    // A saturates Levi with many words; B picks one Judah-only word. Under
    // equal weight, B dilutes Levi to 0.5 exactly — word count is not influence.
    const a = wordsForTribe("levi"); // many words → levi 1.0 for A
    const b = ["Courageous"]; // one word, judah-only → levi 0 for B
    expect(scoreFor("levi", score(a))).toBeCloseTo(1);
    expect(scoreFor("levi", score(b))).toBe(0);

    const agg = aggregateObservers([a, b]);
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
  });

  it("averages a tribe fully seen by all observers to its full score", () => {
    const levi = wordsForTribe("levi");
    const agg = aggregateObservers([levi, levi, levi]);
    expect(scoreFor("levi", agg)).toBeCloseTo(1);
  });

  it("does not mutate the input word lists", () => {
    const a = ["Courageous"];
    const snapshot = [...a];
    aggregateObservers([a]);
    expect(a).toEqual(snapshot);
  });
});
