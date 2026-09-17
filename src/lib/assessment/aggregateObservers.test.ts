import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import { aggregateObservers } from "./aggregateObservers";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const { average } = aggregateObservers([["Courageous"]]);
    expect(average).toHaveLength(12);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("reports the number of observers aggregated", () => {
    expect(aggregateObservers([]).count).toBe(0);
    expect(aggregateObservers([["Courageous"], ["Bold"]]).count).toBe(2);
  });

  it("scores all-zero with no observers", () => {
    const { average, perObserver } = aggregateObservers([]);
    expect(average.every((s) => s.score === 0)).toBe(true);
    expect(perObserver).toEqual([]);
  });

  it("with a single observer, the average equals that observer's own profile", () => {
    const words = wordsForTribe("levi");
    const { average } = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, average)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("averages each tribe over the per-observer normalized scores", () => {
    // The defining property: average[t] is the arithmetic mean of each
    // observer's individually-normalized score for t.
    const responses = [
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
      ["Courageous", "Bold"],
    ];
    const { average, perObserver } = aggregateObservers(responses);
    expect(perObserver).toHaveLength(3);
    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, p) => sum + scoreFor(tribe.slug, p), 0) /
        perObserver.length;
      expect(scoreFor(tribe.slug, average)).toBeCloseTo(mean);
    }
  });

  it("gives every observer equal weight regardless of how many words they picked", () => {
    // One observer fully covers Issachar (10 words → normalized 1.0); another
    // fully covers Levi (6 words → normalized 1.0). Equal-weight averaging must
    // land both at exactly 0.5 — the observer who picked more words does not
    // gain more influence.
    const { average } = aggregateObservers([
      wordsForTribe("issachar"),
      wordsForTribe("levi"),
    ]);
    expect(scoreFor("issachar", average)).toBeCloseTo(0.5);
    expect(scoreFor("levi", average)).toBeCloseTo(0.5);
  });

  it("is an average of normalized profiles, not a pooled bag of words", () => {
    // Observer A fully covers Issachar (issachar = 1.0). Observer B picks a
    // single Judah word (judah ≈ small, issachar = 0). Equal-weight averaging
    // halves Issachar to 0.5. Pooling all words together would instead leave
    // Issachar at 1.0 — this asserts we do NOT pool.
    const heavy = wordsForTribe("issachar");
    const light = ["Courageous"];
    const { average } = aggregateObservers([heavy, light]);

    expect(scoreFor("issachar", average)).toBeCloseTo(0.5);

    const pooled = score([...heavy, ...light]);
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1.0);
    expect(scoreFor("issachar", average)).not.toBeCloseTo(
      scoreFor("issachar", pooled),
    );
  });

  it("exposes each observer's individual normalized profile for drill-down", () => {
    const responses = [wordsForTribe("levi"), wordsForTribe("judah")];
    const { perObserver } = aggregateObservers(responses);
    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(responses[0]));
    expect(perObserver[1]).toEqual(score(responses[1]));
  });

  it("keeps every score within 0–1", () => {
    const { average } = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
      wordsForTribe("judah"),
    ]);
    for (const s of average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});
