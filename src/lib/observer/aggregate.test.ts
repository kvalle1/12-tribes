import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  type ObserverResponseInput,
} from "./aggregate";
import {
  OBSERVER_UNLOCK_THRESHOLD,
  isComparisonUnlocked,
} from "./constants";

const resp = (...words: string[]): ObserverResponseInput => ({ words });

const scoreOf = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("scores every observer individually in canonical 12-tribe order", () => {
    const { perObserver, observerCount } = aggregateObservers([
      resp("Courageous", "Honorable"),
      resp("Creative"),
    ]);
    expect(observerCount).toBe(2);
    expect(perObserver).toHaveLength(2);
    for (const one of perObserver) {
      expect(one.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("returns an all-zero average and no observers for an empty set", () => {
    const { average, perObserver, observerCount } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(average).toHaveLength(12);
    expect(average.every((s) => s.score === 0)).toBe(true);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("averages to a single observer's own scores when there is only one", () => {
    const words = ["Courageous", "Honorable", "Creative"];
    const { average } = aggregateObservers([resp(...words)]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreOf(tribe.slug, average)).toBeCloseTo(
        scoreOf(tribe.slug, self),
      );
    }
  });

  it("is the equal-weight mean of per-observer normalized scores", () => {
    const observers = [
      resp("Courageous", "Honorable", "Authoritative"),
      resp("Creative", "Expressive"),
      resp("Reliable", "Organized", "Faithful", "Consistent"),
    ];
    const { average, perObserver } = aggregateObservers(observers);
    for (let i = 0; i < tribes.length; i++) {
      const mean =
        perObserver.reduce((sum, one) => sum + one[i].score, 0) /
        perObserver.length;
      expect(average[i].score).toBeCloseTo(mean);
    }
  });

  it("averages per-observer profiles rather than pooling everyone's words", () => {
    // Two observers independently read the Subject as Judah ("Courageous"); one
    // reads them as Naphtali ("Creative"). Averaging per-observer profiles lets
    // that Judah consensus count twice — once per observer — so Judah's lead
    // over Naphtali is wider than it would be if every word were thrown into one
    // pooled bag, where score() dedups the repeated "Courageous" to a single
    // contribution. The equal-weight average reinforces agreement; the pooled
    // bag erases it.
    const observers = [resp("Courageous"), resp("Courageous"), resp("Creative")];
    const { average } = aggregateObservers(observers);

    const avgJudah = scoreOf("judah", average);
    const avgNaphtali = scoreOf("naphtali", average);

    const pooled = score(observers.flatMap((o) => o.words));
    const pooledJudah = scoreOf("judah", pooled);
    const pooledNaphtali = scoreOf("naphtali", pooled);

    // Judah's lead over Naphtali is strictly larger under equal-weight averaging
    // than under a pooled bag of words.
    expect(avgJudah / avgNaphtali).toBeGreaterThan(pooledJudah / pooledNaphtali);
  });

  it("is exactly the elementwise mean of the per-observer profiles", () => {
    const observers = [
      resp("Courageous", "Honorable", "Authoritative"),
      resp("Creative"),
    ];
    const { average } = aggregateObservers(observers);
    const selves = observers.map((o) => score(o.words));
    for (const tribe of tribes) {
      const mean =
        selves.reduce((sum, s) => sum + scoreOf(tribe.slug, s), 0) /
        selves.length;
      expect(scoreOf(tribe.slug, average)).toBeCloseTo(mean);
    }
  });

  it("keeps per-observer scores anonymous and in input order", () => {
    const observers = [resp("Courageous"), resp("Creative"), resp("Reliable")];
    const { perObserver } = aggregateObservers(observers);
    // Each entry carries only slug/name/score — no identity, no index back to a
    // person — and the array order matches the input order (the only basis for
    // the anonymous "Observer 1/2/3" labels).
    expect(scoreOf("judah", perObserver[0])).toBeGreaterThan(0);
    expect(scoreOf("naphtali", perObserver[1])).toBeGreaterThan(0);
    expect(scoreOf("joseph", perObserver[2])).toBeGreaterThan(0);
    for (const one of perObserver) {
      for (const s of one) {
        expect(Object.keys(s).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });

  it("produces averages in the normalized 0–1 range", () => {
    const { average } = aggregateObservers([
      resp("Courageous", "Honorable"),
      resp("Creative", "Expressive"),
      resp("Reliable"),
    ]);
    for (const s of average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("compareProfiles", () => {
  it("pairs each tribe's self and others scores with a signed delta", () => {
    const self = score(["Courageous", "Honorable"]);
    const { average } = aggregateObservers([
      resp("Creative", "Expressive"),
      resp("Reliable", "Organized"),
    ]);
    const rows = compareProfiles(self, average);

    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    for (const row of rows) {
      expect(row.delta).toBeCloseTo(row.others - row.self);
    }
  });

  it("signs the delta positive where others see more and negative where they see less", () => {
    const self = score(["Courageous", "Honorable"]); // judah-heavy self
    const others = score(["Creative", "Expressive"]); // naphtali-heavy others
    const rows = compareProfiles(self, others);

    const judah = rows.find((r) => r.slug === "judah")!;
    const naphtali = rows.find((r) => r.slug === "naphtali")!;

    expect(judah.delta).toBeLessThan(0); // others see less Judah than self does
    expect(naphtali.delta).toBeGreaterThan(0); // others see more Naphtali
  });

  it("treats a tribe missing from the others set as zero", () => {
    const self = score(["Courageous"]);
    const rows = compareProfiles(self, []);
    for (const row of rows) {
      expect(row.others).toBe(0);
      expect(row.delta).toBeCloseTo(-row.self);
    }
  });
});

describe("isComparisonUnlocked", () => {
  it("locks below the threshold and unlocks at or above it", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(5)).toBe(true);
  });
});
