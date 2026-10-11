import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isObserverReportUnlocked,
  OBSERVER_REPORT_MINIMUM,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/**
 * A few single-tribe words per slug (from words.ts) — picking all of a tribe's
 * solo words saturates that tribe's normalized score toward its maximum.
 */
const SOLO_WORDS: Record<string, string[]> = {
  judah: ["Authoritative", "Courageous", "Honorable", "Sacrificial"],
  asher: ["Comforting", "Enriching", "Hospitable", "Nurturing", "Peaceful", "Welcoming"],
};
const soloWordsFor = (slug: string) => SOLO_WORDS[slug] ?? [];

describe("aggregateObservers", () => {
  it("returns a 12-tribe 'others' profile in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Nurturing"]]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("counts the observers it aggregated", () => {
    const agg = aggregateObservers([["Courageous"], ["Nurturing"], ["Wise"]]);
    expect(agg.observerCount).toBe(3);
  });

  it("scores each observer individually (normalized, same core as self)", () => {
    const r1 = ["Courageous", "Honorable"];
    const r2 = ["Nurturing", "Peaceful"];
    const agg = aggregateObservers([r1, r2]);

    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(r1));
    expect(agg.perObserver[1]).toEqual(score(r2));
  });

  it("averages per-observer NORMALIZED scores, not a pooled bag of words", () => {
    // Two observers describing the same tribe (judah), but one picks 1 word and
    // the other picks 3. Equal-weight aggregation averages their individually
    // normalized profiles; a pooled bag-of-words would simply sum the picks and
    // over-weight the observer who chose more words.
    const few = ["Courageous"];
    const many = ["Authoritative", "Honorable", "Sacrificial"];
    const agg = aggregateObservers([few, many]);

    const expected =
      (scoreFor("judah", score(few)) + scoreFor("judah", score(many))) / 2;
    expect(scoreFor("judah", agg.others)).toBeCloseTo(expected);

    const pooled = scoreFor("judah", score([...few, ...many]));
    expect(scoreFor("judah", agg.others)).not.toBeCloseTo(pooled);
  });

  it("gives every observer equal influence regardless of how many words they pick", () => {
    // Observer 1 saturates judah; observer 2 saturates asher. Each contributes a
    // full 1.0 to their own tribe, so the equal-weight average lands both at 0.5
    // — identical weight even though judah and asher have different word counts.
    const judahAll = soloWordsFor("judah");
    const asherAll = soloWordsFor("asher");
    const agg = aggregateObservers([judahAll, asherAll]);

    // Each observer's own tribe is fully saturated by its solo words...
    expect(scoreFor("judah", score(judahAll))).toBeGreaterThan(0);
    expect(scoreFor("asher", score(asherAll))).toBeGreaterThan(0);

    // ...and the aggregate weights the two observers equally.
    expect(scoreFor("judah", agg.others)).toBeCloseTo(
      scoreFor("judah", score(judahAll)) / 2,
    );
    expect(scoreFor("asher", agg.others)).toBeCloseTo(
      scoreFor("asher", score(asherAll)) / 2,
    );
  });

  it("treats an all-zero / unknown-word response as a valid zero observer", () => {
    const agg = aggregateObservers([["not-a-real-word"], ["Courageous"]]);
    expect(agg.observerCount).toBe(2);
    // Only the second observer contributes to judah; the unknown-word observer
    // still counts as an equal voice weighted at zero.
    expect(scoreFor("judah", agg.others)).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])) / 2,
    );
  });

  it("returns an all-zero 'others' profile and no observers for an empty set", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
  });

  it("does not mutate its input", () => {
    const input = [["Courageous"], ["Nurturing"]];
    const snapshot = JSON.stringify(input);
    aggregateObservers(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("isObserverReportUnlocked", () => {
  it("locks the report below the minimum observer count", () => {
    expect(isObserverReportUnlocked(0)).toBe(false);
    expect(isObserverReportUnlocked(OBSERVER_REPORT_MINIMUM - 1)).toBe(false);
  });

  it("unlocks at exactly the minimum and above", () => {
    expect(isObserverReportUnlocked(OBSERVER_REPORT_MINIMUM)).toBe(true);
    expect(isObserverReportUnlocked(OBSERVER_REPORT_MINIMUM + 5)).toBe(true);
  });

  it("requires at least three observers (ADR-0003)", () => {
    expect(OBSERVER_REPORT_MINIMUM).toBe(3);
  });
});
