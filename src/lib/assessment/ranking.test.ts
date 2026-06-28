import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "./score";
import { rankResult } from "./ranking";

describe("rankResult", () => {
  it("returns all 12 tribes, ranked by normalized score descending", () => {
    const ranked = rankResult(["Courageous", "Authoritative"], "judah", null);
    expect(ranked).toHaveLength(12);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("includes every tribe exactly once", () => {
    const ranked = rankResult(["Authoritative"], "judah", null);
    const slugs = ranked.map((r) => r.tribe.slug).sort();
    expect(slugs).toEqual([...tribes.map((t) => t.slug)].sort());
  });

  it("assigns 1-based ranks in descending score order", () => {
    const ranked = rankResult(["Authoritative"], "judah", null);
    expect(ranked.map((r) => r.rank)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("makes bar widths proportional to score, with the leader filling the bar", () => {
    const words = ["Authoritative", "Analytical", "Alert"];
    const ranked = rankResult(words, "judah", null);
    const max = Math.max(...score(words).map((s) => s.score));

    expect(ranked[0].barFraction).toBeCloseTo(1, 10);
    for (const r of ranked) {
      expect(r.barFraction).toBeGreaterThanOrEqual(0);
      expect(r.barFraction).toBeLessThanOrEqual(1);
      expect(r.barFraction).toBeCloseTo(r.score / max, 10);
    }
  });

  it("never divides by zero for an all-zero selection", () => {
    const ranked = rankResult([], "judah", null);
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.barFraction === 0)).toBe(true);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });

  it("exposes a rounded display percentage of the normalized score", () => {
    const ranked = rankResult(["Authoritative"], "judah", null);
    for (const r of ranked) {
      expect(r.percent).toBe(Math.round(r.score * 100));
    }
  });

  it("flags exactly the stored Primary tribe", () => {
    const ranked = rankResult(["Authoritative"], "judah", null);
    expect(ranked.filter((r) => r.isPrimary)).toHaveLength(1);
    expect(ranked.find((r) => r.isPrimary)!.tribe.slug).toBe("judah");
  });

  it("flags the stored Secondary tribe when present, by slug not by computed rank", () => {
    const ranked = rankResult(["Authoritative"], "judah", "levi");
    const secondary = ranked.filter((r) => r.isSecondary);
    expect(secondary).toHaveLength(1);
    expect(secondary[0].tribe.slug).toBe("levi");
  });

  it("flags no Secondary when none was stored", () => {
    expect(
      rankResult(["Authoritative"], "judah", null).some((r) => r.isSecondary),
    ).toBe(false);
    expect(
      rankResult(["Authoritative"], "judah", undefined).some(
        (r) => r.isSecondary,
      ),
    ).toBe(false);
  });

  it("resolves full tribe metadata for rendering", () => {
    const ranked = rankResult(["Authoritative"], "judah", null);
    const judah = ranked.find((r) => r.tribe.slug === "judah")!;
    expect(judah.tribe.name).toBe("Judah");
    expect(judah.tribe.hebrew).toBeTruthy();
    expect(judah.tribe.color).toBeTruthy();
  });
});
