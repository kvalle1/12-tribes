import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { deriveResult, score } from "./score";
import { rankResultScores } from "./ranking";

/**
 * `rankResultScores` is the pure display helper behind the enriched result view
 * (#6): it turns a saved selection into ranked rows for all 12 tribes, with
 * proportional bar widths and the Primary/Secondary flags the view highlights.
 * The selection below is engineered to land Judah ahead of the field with a
 * qualifying Benjamin secondary.
 */
const WORDS = [
  "Authoritative",
  "Courageous",
  "Honorable",
  "Sacrificial",
  "Fierce",
  "Aggressive",
  "Bold",
  "Protective",
  "Zealous",
];

describe("rankResultScores", () => {
  it("returns a row for every one of the 12 tribes", () => {
    const rows = rankResultScores(WORDS, "judah");
    expect(rows).toHaveLength(tribes.length);
    expect(new Set(rows.map((r) => r.tribe.slug)).size).toBe(tribes.length);
  });

  it("ranks the rows by normalized score, highest first", () => {
    const rows = rankResultScores(WORDS, "judah");
    const scores = rows.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("carries the same normalized scores the scoring core produces", () => {
    const rows = rankResultScores(WORDS, "judah");
    const bySlug = new Map(score(WORDS).map((s) => [s.slug, s.score]));
    for (const row of rows) {
      expect(row.score).toBeCloseTo(bySlug.get(row.tribe.slug)!, 10);
    }
  });

  it("gives the top tribe a full bar and widths proportional to score", () => {
    const rows = rankResultScores(WORDS, "judah");
    const top = rows[0];
    expect(top.barFraction).toBeCloseTo(1, 10);
    for (const row of rows) {
      const expected = top.score > 0 ? row.score / top.score : 0;
      expect(row.barFraction).toBeCloseTo(expected, 10);
    }
  });

  it("rounds each score to an integer display percent in 0–100", () => {
    const rows = rankResultScores(WORDS, "judah");
    for (const row of rows) {
      expect(row.percent).toBe(Math.round(row.score * 100));
      expect(row.percent).toBeGreaterThanOrEqual(0);
      expect(row.percent).toBeLessThanOrEqual(100);
    }
  });

  it("flags the Primary and (when given) Secondary tribe, and only those", () => {
    const { primary, secondary } = deriveResult(score(WORDS));
    const rows = rankResultScores(WORDS, primary.slug, secondary?.slug);
    expect(rows.filter((r) => r.isPrimary)).toHaveLength(1);
    expect(rows.find((r) => r.isPrimary)!.tribe.slug).toBe(primary.slug);
    if (secondary) {
      expect(rows.filter((r) => r.isSecondary)).toHaveLength(1);
      expect(rows.find((r) => r.isSecondary)!.tribe.slug).toBe(secondary.slug);
    } else {
      expect(rows.some((r) => r.isSecondary)).toBe(false);
    }
  });

  it("flags no Secondary when none is passed", () => {
    const rows = rankResultScores(WORDS, "judah");
    expect(rows.some((r) => r.isSecondary)).toBe(false);
  });

  it("handles an empty selection without dividing by zero", () => {
    const rows = rankResultScores([], "judah");
    expect(rows).toHaveLength(tribes.length);
    for (const row of rows) {
      expect(row.score).toBe(0);
      expect(row.barFraction).toBe(0);
      expect(row.percent).toBe(0);
    }
  });
});
