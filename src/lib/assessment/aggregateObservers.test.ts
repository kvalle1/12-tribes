import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, availablePointsByTribe, type TribeScore } from "./score";
import {
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero 12-tribe profile in canonical order for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
  });

  it("returns exactly one observer's own profile when there is a single response", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const agg = aggregateObservers([words]);
    expect(agg.observerCount).toBe(1);
    expect(agg.others).toEqual(score(words));
    expect(agg.perObserver).toHaveLength(1);
    expect(agg.perObserver[0]).toEqual(score(words));
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // Two observers, each scored on their own, then averaged tribe-by-tribe.
    const a = ["Courageous"]; // judah-only
    const b = ["Bold"]; // judah + reuben, 0.5 each
    const agg = aggregateObservers([a, b]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, score(a)) + scoreFor(tribe.slug, score(b))) / 2;
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(expected);
    }
  });

  it("is an equal-weight average of profiles, not a pooled bag of words", () => {
    // "Courageous" gives judah a full point; "Bold" gives it half. Pooling the
    // two selections and scoring once would credit judah 1.5/available; the
    // equal-weight average of the two normalized profiles credits it only
    // 0.75/available — half as much. This is the property that stops a
    // word-heavy observer from dominating.
    const a = ["Courageous"];
    const b = ["Bold"];
    const av = availablePointsByTribe["judah"];

    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    expect(scoreFor("judah", agg.others)).toBeCloseTo(0.75 / av);
    expect(scoreFor("judah", pooled)).toBeCloseTo(1.5 / av);
    // And the two are genuinely different, not merely close.
    expect(scoreFor("judah", agg.others)).not.toBeCloseTo(
      scoreFor("judah", pooled),
    );
  });

  it("gives an observer who picks more words no more influence than one who picks few", () => {
    // Observer A saturates levi (all 6 of its words → levi = 1.0). Observer B
    // picks a single judah word. Each still contributes exactly half the
    // aggregate: levi lands at 0.5 (A's 1.0 halved), and B's lone word carries
    // its full normalized judah score, also halved — A's six words buy no extra
    // sway.
    const a = wordsForTribe("levi");
    const b = ["Courageous"];
    const av = availablePointsByTribe["judah"];

    const agg = aggregateObservers([a, b]);

    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(1 / av / 2);
  });

  it("exposes each observer's own profile for anonymous drill-down", () => {
    const a = ["Courageous", "Bold"];
    const b = wordsForTribe("levi");
    const c = ["Zealous"];
    const agg = aggregateObservers([a, b, c]);

    expect(agg.perObserver).toHaveLength(3);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    expect(agg.perObserver[2]).toEqual(score(c));
    // Each drill-down profile is a full 12-tribe profile in canonical order.
    for (const profile of agg.perObserver) {
      expect(profile.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("counts observers and ignores unknown words per observer (via the scoring core)", () => {
    const agg = aggregateObservers([
      ["Courageous", "notaword"],
      ["Courageous"],
    ]);
    expect(agg.observerCount).toBe(2);
    // Both observers reduce to the same judah-only selection, so the average
    // equals a single observer's judah score.
    expect(scoreFor("judah", agg.others)).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])),
    );
  });
});

describe("isReportUnlocked", () => {
  it("locks below the threshold and unlocks at or above it", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(9)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("pairs self and others by tribe in canonical order with the signed gap", () => {
    const self = score(["Courageous"]); // judah-heavy
    const others = score(["Bold"]); // judah + reuben
    const rows = compareProfiles(self, others);

    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    for (const row of rows) {
      expect(row.delta).toBeCloseTo(row.others - row.self);
    }
  });

  it("signs the delta so positive means others see the tribe more than the Subject", () => {
    const self = score(["Courageous"]); // strong judah for self
    const others = score(["Loyal"]); // a non-judah word (see word list)
    const rows = compareProfiles(self, others);

    const judah = rows.find((r) => r.slug === "judah")!;
    // Self reads judah more strongly than others do → negative delta.
    expect(judah.self).toBeGreaterThan(judah.others);
    expect(judah.delta).toBeLessThan(0);
  });
});
