import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { deriveResult, score } from "./score";
import { buildRanking, accentHex } from "./ranking";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/**
 * A realistic, in-range (8–15 words) selection that lands Levi as Primary with a
 * supporting spread, mirroring what a saved result holds. Derive the headline
 * from the same scoring core the page uses, so the test exercises the real path.
 */
const leviSelection = [...wordsForTribe("levi"), "Courageous", "Bold"];
const leviHeadline = deriveResult(score(leviSelection));

describe("buildRanking", () => {
  it("returns one row for every tribe", () => {
    const rows = buildRanking(leviSelection, leviHeadline.primary.slug);
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(12);
  });

  it("orders rows by score, strongest first", () => {
    const rows = buildRanking(leviSelection, leviHeadline.primary.slug);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    }
    // The highest-scoring row matches the derived Primary.
    expect(rows[0].slug).toBe(leviHeadline.primary.slug);
  });

  it("gives the top tribe a full bar and scales the rest against it", () => {
    const rows = buildRanking(leviSelection, leviHeadline.primary.slug);
    expect(rows[0].barFraction).toBeCloseTo(1);
    for (const row of rows) {
      expect(row.barFraction).toBeGreaterThanOrEqual(0);
      expect(row.barFraction).toBeLessThanOrEqual(1);
      // barFraction is score relative to the top score.
      expect(row.barFraction).toBeCloseTo(row.score / rows[0].score);
    }
  });

  it("flags the Primary and Secondary badges, and nothing else", () => {
    const rows = buildRanking(
      tableSelection(),
      "judah",
      "reuben",
    );
    const primary = rows.find((r) => r.badge === "primary");
    const secondary = rows.find((r) => r.badge === "secondary");
    expect(primary?.slug).toBe("judah");
    expect(secondary?.slug).toBe("reuben");
    expect(rows.filter((r) => r.badge !== null)).toHaveLength(2);
  });

  it("flags only the Primary when there is no Secondary", () => {
    const rows = buildRanking(tableSelection(), "judah", null);
    expect(rows.filter((r) => r.badge !== null)).toHaveLength(1);
    expect(rows.find((r) => r.badge === "primary")?.slug).toBe("judah");
  });

  it("exposes a display percentage that matches the normalized score", () => {
    const rows = buildRanking(leviSelection, leviHeadline.primary.slug);
    for (const row of rows) {
      expect(row.percent).toBe(Math.round(row.score * 100));
    }
  });

  it("carries a non-empty accent hex for every tribe", () => {
    const rows = buildRanking(leviSelection, leviHeadline.primary.slug);
    for (const row of rows) {
      expect(row.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keeps all bar fractions at 0 for an empty selection (no divide-by-zero)", () => {
    const rows = buildRanking([], "judah");
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.barFraction === 0)).toBe(true);
  });
});

describe("accentHex", () => {
  it("resolves a known color to its hex", () => {
    expect(accentHex("amber")).toBe("#b8860b");
  });

  it("falls back to brass for an unknown color", () => {
    expect(accentHex("not-a-color")).toBe("#a9842f");
  });

  it("has a hex for every color used by the tribes data", () => {
    for (const tribe of tribes) {
      expect(accentHex(tribe.color)).not.toBe("#a9842f");
    }
  });
});

/**
 * A selection that scores Judah clearly first and Reuben a near Secondary, for
 * the badge tests. "Bold" maps to Judah+Reuben; the extra Judah-only words push
 * Judah to the top.
 */
function tableSelection(): string[] {
  return [...wordsForTribe("judah"), "Bold", ...wordsForTribe("reuben").slice(0, 2)];
}
