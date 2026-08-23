import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS_FOR_REPORT } from "./aggregate";

/** All words that map to a given tribe slug (single- or multi-tribe). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** The score for a slug within a TribeScore[] table. */
const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero, canonical-order profile for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.observers).toHaveLength(0);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the single observer's own normalized profile when there is one", () => {
    const words = wordsForTribe("judah").slice(0, 4);
    const agg = aggregateObservers([words]);
    expect(agg.observerCount).toBe(1);
    // The "others" average of one observer is exactly that observer's profile.
    expect(agg.average).toEqual(score(words));
  });

  it("averages per-observer normalized scores with equal weight (not a pooled bag of words)", () => {
    // A wordy observer and a terse one, on disjoint word sets, so pooling the
    // words would let the wordy observer dominate.
    const a = WORDS.slice(0, 11).map((w) => w.word);
    const b = WORDS.slice(11, 14).map((w) => w.word);

    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    const pooled = score([...a, ...b]);

    // Equal-weight: every tribe is the elementwise mean of the two profiles.
    for (let i = 0; i < tribes.length; i++) {
      expect(agg.average[i].slug).toBe(tribes[i].slug);
      expect(agg.average[i].score).toBeCloseTo((sa[i].score + sb[i].score) / 2, 12);
    }

    // And that equal-weight average is genuinely different from pooling the
    // words — the property ADR-0003 turns on. Since |a| != |b|, at least one
    // tribe must differ from the pooled score.
    const differsSomewhere = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, agg.average) - scoreFor(t.slug, pooled)) >
        1e-9,
    );
    expect(differsSomewhere).toBe(true);
  });

  it("gives each observer equal influence regardless of how many words they picked", () => {
    // One observer overwhelmingly Judah, another overwhelmingly Levi, with very
    // different word counts. Equal weighting must keep their contributions even.
    const judahHeavy = wordsForTribe("judah").slice(0, 8);
    const leviLight = wordsForTribe("levi").slice(0, 2);

    const agg = aggregateObservers([judahHeavy, leviLight]);
    const judahAlone = score(judahHeavy);
    const leviAlone = score(leviLight);

    // Each tribe's aggregate is half of that tribe's contribution from the one
    // observer who expressed it — neither observer's word count changes its weight.
    expect(scoreFor("judah", agg.average)).toBeCloseTo(
      scoreFor("judah", judahAlone) / 2,
      12,
    );
    expect(scoreFor("levi", agg.average)).toBeCloseTo(
      scoreFor("levi", leviAlone) / 2,
      12,
    );
  });

  it("exposes each observer's own profile for anonymous drill-down, 1-based and in order", () => {
    const a = wordsForTribe("judah").slice(0, 4);
    const b = wordsForTribe("levi").slice(0, 4);
    const c = wordsForTribe("dan").slice(0, 4);

    const agg = aggregateObservers([a, b, c]);
    expect(agg.observerCount).toBe(3);
    expect(agg.observers.map((o) => o.index)).toEqual([1, 2, 3]);
    expect(agg.observers[0].scores).toEqual(score(a));
    expect(agg.observers[1].scores).toEqual(score(b));
    expect(agg.observers[2].scores).toEqual(score(c));
  });

  it("ignores unknown words via the shared scoring core", () => {
    const words = wordsForTribe("judah").slice(0, 3);
    const withJunk = [...words, "not-a-real-word", "another-fake"];
    expect(aggregateObservers([withJunk]).average).toEqual(
      aggregateObservers([words]).average,
    );
  });

  it("sets the report unlock threshold to 3 observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
