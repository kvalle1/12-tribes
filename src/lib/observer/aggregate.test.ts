import { describe, it, expect } from "vitest";
import { aggregateObservers } from "./aggregate";
import { score } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * These tests pin the one property the whole 360 report rests on: the "others"
 * profile is the equal-weight average of per-Observer normalized profiles, not a
 * score over a pooled bag of everyone's words. Real words from the catalog are
 * used so the assertions exercise the actual scoring core.
 */

const tribeIndex = (slug: string) => tribes.findIndex((t) => t.slug === slug);
const judah = tribeIndex("judah");

describe("aggregateObservers", () => {
  it("returns the equal-weight average of per-observer normalized scores", () => {
    const a = { words: ["Courageous", "Authoritative"] }; // both → judah
    const b = { words: ["Comforting"] }; // → asher

    const agg = aggregateObservers([a, b]);
    const sa = score(a.words);
    const sb = score(b.words);

    // Every tribe's aggregated score is the plain mean of the two profiles.
    tribes.forEach((_, i) => {
      expect(agg.others[i].score).toBeCloseTo((sa[i].score + sb[i].score) / 2);
    });
  });

  it("averages normalized profiles rather than pooling everyone's words", () => {
    // One Observer picks a single judah word, the other picks two. If we pooled
    // the words we'd score ["Courageous", "Authoritative"] once (judah earns 2);
    // averaging normalized profiles instead gives the mean of judah=1 and
    // judah=2, i.e. judah=1.5 worth of points — strictly less than pooling.
    const light = { words: ["Courageous"] };
    const heavy = { words: ["Courageous", "Authoritative"] };

    const agg = aggregateObservers([light, heavy]);
    const pooled = score(["Courageous", "Authoritative"]);
    const mean =
      (score(light.words)[judah].score + score(heavy.words)[judah].score) / 2;

    expect(agg.others[judah].score).toBeCloseTo(mean);
    expect(agg.others[judah].score).not.toBeCloseTo(pooled[judah].score);
    expect(agg.others[judah].score).toBeLessThan(pooled[judah].score);
  });

  it("gives each observer equal weight regardless of how many words they pick", () => {
    // A prolific Observer (many words, all judah) must not out-vote a terse one.
    // Both land on judah, so each contributes its own normalized judah score and
    // the average is their simple mean — the word count does not tilt influence.
    const terse = { words: ["Courageous"] };
    const prolific = {
      words: ["Courageous", "Authoritative", "Bold", "Decisive", "Driven"],
    };

    const agg = aggregateObservers([terse, prolific]);
    const expected =
      (score(terse.words)[judah].score + score(prolific.words)[judah].score) / 2;

    expect(agg.others[judah].score).toBeCloseTo(expected);
  });

  it("is order-independent for the aggregate profile (mean commutes)", () => {
    const a = { words: ["Courageous", "Bold"] };
    const b = { words: ["Comforting", "Analytical"] };
    const c = { words: ["Creative"] };

    const forward = aggregateObservers([a, b, c]).others;
    const reversed = aggregateObservers([c, b, a]).others;

    forward.forEach((row, i) => {
      expect(row.score).toBeCloseTo(reversed[i].score);
    });
  });

  it("exposes per-observer profiles in input order for anonymous drill-down", () => {
    const a = { words: ["Courageous"] };
    const b = { words: ["Comforting"] };

    const agg = aggregateObservers([a, b]);

    expect(agg.perObserver).toHaveLength(2);
    // Each drill-down profile is a full 12-tribe scored profile...
    expect(agg.perObserver[0]).toHaveLength(tribes.length);
    // ...matching that Observer's own words, in the order they were supplied.
    expect(agg.perObserver[0][judah].score).toBeCloseTo(score(a.words)[judah].score);
    expect(agg.perObserver[1][judah].score).toBe(0); // b picked no judah word
    // The drill-down carries only scores — nothing that could identify anyone.
    expect(Object.keys(agg.perObserver[0][0]).sort()).toEqual([
      "name",
      "score",
      "slug",
    ]);
  });

  it("reports the observer count", () => {
    expect(aggregateObservers([{ words: ["Courageous"] }]).count).toBe(1);
    expect(
      aggregateObservers([{ words: ["Courageous"] }, { words: ["Comforting"] }])
        .count,
    ).toBe(2);
  });

  it("returns an all-zero profile and empty drill-down for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.count).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(tribes.length);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
  });

  it("ignores unknown words within an observer's selection", () => {
    const withNoise = { words: ["Courageous", "definitely-not-a-word"] };
    const clean = { words: ["Courageous"] };
    expect(aggregateObservers([withNoise]).others[judah].score).toBeCloseTo(
      aggregateObservers([clean]).others[judah].score,
    );
  });
});
