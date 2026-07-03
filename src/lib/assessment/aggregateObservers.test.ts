import { describe, expect, it } from "vitest";
import { score } from "./score";
import { tribes } from "@/lib/tribes";
import {
  MIN_OBSERVERS,
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  scoreEachObserver,
} from "./aggregateObservers";

/**
 * Behavioral spec for the equal-weight "others" aggregation (issue #9,
 * ADR-0003). Tests assert the module's external contract — the aggregate profile
 * and comparison it produces — never its internals. Expected values are derived
 * from the real scoring core rather than hard-coded magic numbers, so the tests
 * survive any tuning of the normalization denominators.
 */

const scoreOf = (words: string[], slug: string) =>
  score(words).find((t) => t.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("is the equal-weight mean of each observer's individual profile", () => {
    const observers = [
      ["Analytical", "Insightful", "Learned"],
      ["Bold", "Courageous", "Honorable"],
      ["Nurturing", "Peaceful", "Welcoming"],
    ];

    const perObserver = scoreEachObserver(observers);
    const aggregate = aggregateObservers(observers);

    // Every tribe's aggregate score equals the plain average of that tribe's
    // score across the three observers.
    for (const tribe of tribes) {
      const mean =
        perObserver.reduce(
          (sum, o) => sum + o.find((t) => t.slug === tribe.slug)!.score,
          0,
        ) / perObserver.length;
      const got = aggregate.find((t) => t.slug === tribe.slug)!.score;
      expect(got).toBeCloseTo(mean, 10);
    }
  });

  it("is equal-weight, not a pooled bag of words — a wordier observer gains no extra sway", () => {
    // Observer A gives a thin read of Issachar (one word); Observer B a rich one
    // (all six single-tribe Issachar words). Pooling their words would let B's
    // richer selection set the value; equal-weight averages their two views.
    const thin = ["Analytical"];
    const rich = ["Analytical", "Insightful", "Learned", "Measured", "Patient", "Wise"];

    const aggregate = aggregateObservers([thin, rich]);
    const issacharAggregate = aggregate.find((t) => t.slug === "issachar")!.score;

    const expectedEqualWeight =
      (scoreOf(thin, "issachar") + scoreOf(rich, "issachar")) / 2;
    const pooled = scoreOf([...thin, ...rich], "issachar");

    expect(issacharAggregate).toBeCloseTo(expectedEqualWeight, 10);
    // The equal-weight value is strictly below the pooled value: the thin
    // observer pulls the average down instead of being drowned out.
    expect(issacharAggregate).toBeLessThan(pooled);
  });

  it("gives every observer one vote regardless of how many words they pick", () => {
    // A fully saturates Issachar (many words), B gives a single Naphtali word.
    // Neither the count nor the coverage of A's selection lets Issachar dominate
    // the average: each is exactly half of its owner's individual score.
    const saturateIssachar = [
      "Analytical", "Insightful", "Learned", "Measured", "Patient", "Wise",
    ];
    const oneNaphtali = ["Creative"];

    const aggregate = aggregateObservers([saturateIssachar, oneNaphtali]);

    expect(aggregate.find((t) => t.slug === "issachar")!.score).toBeCloseTo(
      scoreOf(saturateIssachar, "issachar") / 2,
      10,
    );
    expect(aggregate.find((t) => t.slug === "naphtali")!.score).toBeCloseTo(
      scoreOf(oneNaphtali, "naphtali") / 2,
      10,
    );
  });

  it("returns a score for every tribe in canonical order", () => {
    const aggregate = aggregateObservers([["Analytical"], ["Bold"]]);
    expect(aggregate.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns all-zero scores for no observers", () => {
    const aggregate = aggregateObservers([]);
    expect(aggregate).toHaveLength(tribes.length);
    expect(aggregate.every((t) => t.score === 0)).toBe(true);
  });
});

describe("scoreEachObserver", () => {
  it("preserves observer order and count for stable anonymous labeling", () => {
    const observers = [["Analytical"], ["Bold"], ["Creative"]];
    const perObserver = scoreEachObserver(observers);

    expect(perObserver).toHaveLength(3);
    // Observer 1's strongest tribe is Issachar; Observer 3's is Naphtali.
    const top = (scores: (typeof perObserver)[number]) =>
      [...scores].sort((a, b) => b.score - a.score)[0].slug;
    expect(top(perObserver[0])).toBe("issachar");
    expect(top(perObserver[2])).toBe("naphtali");
  });
});

describe("isReportUnlocked / MIN_OBSERVERS", () => {
  it("unlocks only at or above the minimum observer count", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("computes signed divergence (self − others) per tribe, matched by slug", () => {
    const self = score(["Analytical", "Insightful", "Learned"]); // leans Issachar
    const others = aggregateObservers([["Bold", "Courageous", "Honorable"]]); // leans Judah

    const comparison = compareProfiles(self, others);
    const issachar = comparison.find((c) => c.slug === "issachar")!;
    const judah = comparison.find((c) => c.slug === "judah")!;

    // Subject sees more Issachar than others do → positive divergence.
    expect(issachar.divergence).toBeGreaterThan(0);
    expect(issachar.divergence).toBeCloseTo(issachar.self - issachar.others, 10);
    // Others see more Judah than the Subject does → negative divergence.
    expect(judah.divergence).toBeLessThan(0);
  });

  it("matches tribes by slug even when the two profiles are ordered differently", () => {
    const self = score(["Analytical"]);
    const othersReversed = [...aggregateObservers([["Analytical"]])].reverse();

    const comparison = compareProfiles(self, othersReversed);
    // Order follows the self profile (canonical), and each tribe is paired with
    // its own slug's others-score despite the reversed input.
    expect(comparison.map((c) => c.slug)).toEqual(self.map((t) => t.slug));
    for (const c of comparison) {
      expect(c.divergence).toBeCloseTo(0, 10);
    }
  });
});
