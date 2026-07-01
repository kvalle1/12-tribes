import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

/** All words that map to a given tribe slug (mirrors the score test helper). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreOf = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("reports the number of observer responses", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(agg.count).toBe(3);
    expect(agg.observers).toHaveLength(3);
  });

  it("returns an all-zero, empty aggregate for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.count).toBe(0);
    expect(agg.observers).toHaveLength(0);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("produces the average per tribe in canonical (tribe number) order", () => {
    const agg = aggregateObservers([wordsForTribe("judah")]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("labels observers 1..n by input order and scores each individually", () => {
    const r1 = wordsForTribe("judah");
    const r2 = wordsForTribe("levi");
    const agg = aggregateObservers([r1, r2]);
    expect(agg.observers.map((o) => o.index)).toEqual([1, 2]);
    // Each observer's profile is that response's own normalized score, unpooled.
    expect(agg.observers[0].scores).toEqual(score(r1));
    expect(agg.observers[1].scores).toEqual(score(r2));
  });

  it("with a single observer, the average equals that observer's score", () => {
    const r1 = wordsForTribe("judah");
    const agg = aggregateObservers([r1]);
    const single = score(r1);
    for (const row of agg.average) {
      expect(row.score).toBeCloseTo(scoreOf(row.slug, single));
    }
  });

  it("is the equal-weight average of each observer's normalized scores", () => {
    // The defining behaviour (ADR-0003): average the per-observer *normalized*
    // scores, tribe by tribe — never pool everyone's words into one bag.
    const r1 = [...wordsForTribe("judah"), "Bold"];
    const r2 = [...wordsForTribe("levi"), "Zealous"];
    const agg = aggregateObservers([r1, r2]);
    const s1 = score(r1);
    const s2 = score(r2);
    for (const row of agg.average) {
      const expected =
        (scoreOf(row.slug, s1) + scoreOf(row.slug, s2)) / 2;
      expect(row.score).toBeCloseTo(expected);
    }
  });

  it("counts each observer equally regardless of how many words they picked", () => {
    // A wordy observer (all 10 of Issachar's words) and a brief one (a few of
    // Levi's). Under equal weighting the wordy observer's read is diluted to
    // half; a pooled "bag of words" would instead let it dominate.
    const wordy = wordsForTribe("issachar");
    const brief = wordsForTribe("levi").slice(0, 3);
    const agg = aggregateObservers([wordy, brief]);

    const issacharEqual = scoreOf("issachar", agg.average);
    const issacharPooled = scoreOf("issachar", score([...wordy, ...brief]));
    // Equal weighting halves the wordy observer's dominant tribe; pooling keeps
    // it high — proving we average normalized profiles, not pool words.
    expect(issacharEqual).toBeLessThan(issacharPooled);
    expect(issacharEqual).toBeCloseTo(scoreOf("issachar", score(wordy)) / 2);
  });

  it("unlocks the report at three observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
