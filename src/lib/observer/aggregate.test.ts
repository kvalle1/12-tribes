import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isObserverReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreOf = (scores: readonly TribeScore[], slug: string) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a score for every tribe in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("reports the number of observers aggregated", () => {
    expect(aggregateObservers([]).observerCount).toBe(0);
    expect(
      aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]).observerCount,
    ).toBe(3);
  });

  it("scores all-zero for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
    expect(agg.perObserver).toEqual([]);
  });

  it("is the equal-weight average of each observer's normalized score", () => {
    // The core contract (ADR-0003): average the per-observer *normalized*
    // profiles, so the result equals the arithmetic mean of score() per tribe.
    const a = wordsForTribe("levi");
    const b = ["Courageous", "Bold"];
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreOf(sa, tribe.slug) + scoreOf(sb, tribe.slug)) / 2;
      expect(scoreOf(agg.scores, tribe.slug)).toBeCloseTo(expected);
    }
  });

  it("averages equally, NOT as a pooled bag of words", () => {
    // One observer names a single levi word; another names every levi word.
    // Equal-weight averaging keeps the terse observer's voice at full strength,
    // so levi lands strictly below the 1.0 a pooled union of the same words
    // would produce.
    const terse = [wordsForTribe("levi")[0]];
    const verbose = wordsForTribe("levi");
    const agg = aggregateObservers([terse, verbose]);

    const equalWeight =
      (scoreOf(score(terse), "levi") + scoreOf(score(verbose), "levi")) / 2;
    const pooled = scoreOf(score([...terse, ...verbose]), "levi");

    expect(scoreOf(agg.scores, "levi")).toBeCloseTo(equalWeight);
    expect(pooled).toBeCloseTo(1); // union covers all of levi
    expect(scoreOf(agg.scores, "levi")).toBeLessThan(pooled);
  });

  it("gives a verbose observer no more influence than a terse one", () => {
    // Two observers pull toward different tribes; the one who selected more
    // words must not dominate the average.
    const verboseLevi = wordsForTribe("levi"); // many words
    const terseJudah = ["Courageous"]; // one word, judah-only
    const agg = aggregateObservers([verboseLevi, terseJudah]);
    // Each observer contributes exactly half of their own normalized peak.
    expect(scoreOf(agg.scores, "levi")).toBeCloseTo(
      scoreOf(score(verboseLevi), "levi") / 2,
    );
    expect(scoreOf(agg.scores, "judah")).toBeCloseTo(
      scoreOf(score(terseJudah), "judah") / 2,
    );
  });

  it("exposes each observer's individual normalized profile, anonymously by index", () => {
    const responses = [["Courageous"], wordsForTribe("levi")];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(responses[0]));
    expect(agg.perObserver[1]).toEqual(score(responses[1]));
    // The shape carries no observer identity — only scores.
    for (const profile of agg.perObserver) {
      for (const s of profile) {
        expect(Object.keys(s).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });
});

describe("isObserverReportUnlocked", () => {
  it("locks below the threshold and unlocks at or above it", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isObserverReportUnlocked(0)).toBe(false);
    expect(isObserverReportUnlocked(2)).toBe(false);
    expect(isObserverReportUnlocked(3)).toBe(true);
    expect(isObserverReportUnlocked(5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("returns a row per tribe carrying both scores and their gap", () => {
    const self = score(wordsForTribe("levi"));
    const others = score(wordsForTribe("judah"));
    const rows = compareProfiles(self, others);
    expect(rows).toHaveLength(12);
    const levi = rows.find((r) => r.slug === "levi")!;
    expect(levi.self).toBeCloseTo(scoreOf(self, "levi"));
    expect(levi.others).toBeCloseTo(scoreOf(others, "levi"));
    // delta is others − self: observers see less levi than the subject does.
    expect(levi.delta).toBeCloseTo(levi.others - levi.self);
    expect(levi.delta).toBeLessThan(0);
  });

  it("draws both bars on one shared scale (top score across both fills the bar)", () => {
    const self = score(wordsForTribe("levi"));
    const others = score(["Courageous"]);
    const rows = compareProfiles(self, others);
    const maxRelative = Math.max(
      ...rows.map((r) => Math.max(r.relativeSelf, r.relativeOthers)),
    );
    expect(maxRelative).toBeCloseTo(1);
    for (const r of rows) {
      expect(r.relativeSelf).toBeGreaterThanOrEqual(0);
      expect(r.relativeSelf).toBeLessThanOrEqual(1);
      expect(r.relativeOthers).toBeGreaterThanOrEqual(0);
      expect(r.relativeOthers).toBeLessThanOrEqual(1);
    }
  });

  it("orders by the stronger of the two signals so the salient tribes lead", () => {
    const self = score(wordsForTribe("levi"));
    const others = score(wordsForTribe("judah"));
    const rows = compareProfiles(self, others);
    const strength = rows.map((r) => Math.max(r.self, r.others));
    const sorted = [...strength].sort((a, b) => b - a);
    expect(strength).toEqual(sorted);
    // levi (self peak) and judah (others peak) surface at the top.
    expect(rows.slice(0, 2).map((r) => r.slug).sort()).toEqual([
      "judah",
      "levi",
    ]);
  });

  it("handles all-zero others (no signal) without dividing by zero", () => {
    const self = score(wordsForTribe("levi"));
    const others = score([]);
    const rows = compareProfiles(self, others);
    for (const r of rows) {
      expect(r.others).toBe(0);
      expect(r.relativeOthers).toBe(0);
      expect(Number.isFinite(r.relativeSelf)).toBe(true);
    }
  });
});
