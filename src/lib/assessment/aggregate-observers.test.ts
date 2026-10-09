import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate-observers";

const otherScore = (slug: string, others: { slug: string; score: number }[]) =>
  others.find((o) => o.slug === slug)!.score;

/** The equal-weight mean of a set of per-observer scores for one tribe. */
const meanFor = (slug: string, responses: string[][]) => {
  const scores = responses.map(
    (words) => score(words).find((s) => s.slug === slug)!.score,
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
};

// Clean single-tribe selections keep the expected profiles easy to reason about.
const JUDAH = ["Authoritative", "Courageous", "Honorable", "Sacrificial"];
const LEVI = ["Dedicated", "Devoted", "Exacting", "Precise", "Reverent"];
const ASHER = ["Comforting", "Enriching", "Hospitable", "Nurturing", "Peaceful"];

describe("aggregateObservers", () => {
  it("returns a full 12-tribe others profile in canonical order", () => {
    const { others } = aggregateObservers([JUDAH, LEVI, ASHER]);
    expect(others).toHaveLength(12);
    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is the equal-weight average of each observer's normalized score", () => {
    const responses = [JUDAH, LEVI, ASHER];
    const { others } = aggregateObservers(responses);
    for (const tribe of tribes) {
      expect(otherScore(tribe.slug, others)).toBeCloseTo(
        meanFor(tribe.slug, responses),
      );
    }
  });

  it("counts each observer equally regardless of how many words they picked", () => {
    // One observer picks a large Judah set, another a small one. Equal weight
    // means the others-score for Judah is the plain mean of their two normalized
    // scores — the word-heavy observer does not dominate.
    const heavy = JUDAH; // 4 Judah words
    const light = ["Courageous"]; // 1 Judah word
    const { others } = aggregateObservers([heavy, light]);

    const heavyJudah = score(heavy).find((s) => s.slug === "judah")!.score;
    const lightJudah = score(light).find((s) => s.slug === "judah")!.score;

    expect(otherScore("judah", others)).toBeCloseTo(
      (heavyJudah + lightJudah) / 2,
    );
  });

  it("is NOT a pooled bag of words (dedup across observers would change the shape)", () => {
    // Two observers who both picked "Courageous" plus their own distinct words.
    // A pooled bag would collapse the shared word once; equal-weight counts it
    // inside each observer's own normalized profile, so the two disagree.
    const a = ["Courageous", "Honorable"]; // judah
    const b = ["Courageous", "Dedicated", "Devoted"]; // judah + levi
    const { others } = aggregateObservers([a, b]);

    const pooled = score([...a, ...b]); // what a naive pooled-bag would produce
    const pooledJudah = pooled.find((s) => s.slug === "judah")!.score;

    expect(otherScore("judah", others)).toBeCloseTo(meanFor("judah", [a, b]));
    expect(otherScore("judah", others)).not.toBeCloseTo(pooledJudah);
  });

  it("exposes an anonymous per-observer breakdown in submission order", () => {
    const responses = [JUDAH, LEVI, ASHER];
    const { perObserver } = aggregateObservers(responses);

    expect(perObserver).toHaveLength(3);
    // Each entry is a full tribe-score table and nothing more — no identity.
    for (const [i, obs] of perObserver.entries()) {
      expect(obs).toEqual(score(responses[i]));
      for (const row of obs) {
        expect(Object.keys(row).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });

  it("reports the number of observers aggregated", () => {
    expect(aggregateObservers([]).count).toBe(0);
    expect(aggregateObservers([JUDAH]).count).toBe(1);
    expect(aggregateObservers([JUDAH, LEVI, ASHER]).count).toBe(3);
  });

  it("returns an all-zero others profile for no responses", () => {
    const { others, perObserver } = aggregateObservers([]);
    expect(perObserver).toEqual([]);
    expect(others.every((o) => o.score === 0)).toBe(true);
  });
});

describe("isReportUnlocked", () => {
  it("locks below the minimum and unlocks at the threshold", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});
