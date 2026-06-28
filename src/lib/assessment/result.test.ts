import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { resolveHeadline, buildResultView } from "./result";

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const rank = (slug: string, view: ReturnType<typeof buildResultView>) =>
  view.ranking.find((r) => r.tribe.slug === slug)!;

describe("resolveHeadline", () => {
  it("resolves a primary slug to its tribe", () => {
    expect(resolveHeadline("judah").primary.slug).toBe("judah");
  });

  it("resolves a secondary when given", () => {
    const { secondary } = resolveHeadline("judah", "levi");
    expect(secondary?.slug).toBe("levi");
  });

  it("omits the secondary when absent", () => {
    expect(resolveHeadline("judah", null).secondary).toBeUndefined();
    expect(resolveHeadline("judah").secondary).toBeUndefined();
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nottribe")).toThrow();
  });
});

describe("buildResultView", () => {
  const scores = tableFrom({ judah: 1.0, reuben: 0.5, levi: 0.25 });

  it("ranks all 12 tribes descending by score", () => {
    const { ranking } = buildResultView(scores, "judah", "reuben", ["Bold"]);
    expect(ranking).toHaveLength(12);
    const values = ranking.map((r) => r.score);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(ranking[0].tribe.slug).toBe("judah");
  });

  it("resolves the primary and secondary tribe objects", () => {
    const view = buildResultView(scores, "judah", "reuben", ["Bold"]);
    expect(view.primary.slug).toBe("judah");
    expect(view.secondary?.slug).toBe("reuben");
  });

  it("omits the secondary when none was saved", () => {
    const view = buildResultView(scores, "judah", null, ["Bold"]);
    expect(view.secondary).toBeUndefined();
  });

  it("sets bar width to the normalized score as a percentage (width == label)", () => {
    // A leader below 1.0 distinguishes absolute scaling from leader-relative:
    // judah 0.5 → 50% (not 100%), reuben 0.25 → 25%.
    const partial = tableFrom({ judah: 0.5, reuben: 0.25 });
    const view = buildResultView(partial, "judah", "reuben", ["Bold"]);
    expect(rank("judah", view).widthPct).toBeCloseTo(50);
    expect(rank("reuben", view).widthPct).toBeCloseTo(25);
    expect(rank("levi", view).widthPct).toBeCloseTo(0);
  });

  it("gives every bar zero width when nothing scored (no divide-by-zero)", () => {
    const view = buildResultView(tableFrom({}), "judah", null, ["Bold"]);
    expect(view.ranking).toHaveLength(12);
    expect(view.ranking.every((r) => r.widthPct === 0)).toBe(true);
  });

  it("flags exactly the primary and secondary rows", () => {
    const view = buildResultView(scores, "judah", "reuben", ["Bold"]);
    expect(view.ranking.filter((r) => r.isPrimary).map((r) => r.tribe.slug)).toEqual([
      "judah",
    ]);
    expect(
      view.ranking.filter((r) => r.isSecondary).map((r) => r.tribe.slug),
    ).toEqual(["reuben"]);
  });

  it("carries the selected words through unchanged", () => {
    const words = ["Bold", "Courageous", "Zealous"];
    expect(buildResultView(scores, "judah", null, words).words).toEqual(words);
  });

  it("breaks ranking ties by canonical tribe order", () => {
    // judah (#1) and benjamin (#6) tie; judah sorts first.
    const tied = tableFrom({ judah: 0.7, benjamin: 0.7 });
    const { ranking } = buildResultView(tied, "judah", "benjamin", ["Bold"]);
    const judahPos = ranking.findIndex((r) => r.tribe.slug === "judah");
    const benjaminPos = ranking.findIndex((r) => r.tribe.slug === "benjamin");
    expect(judahPos).toBeLessThan(benjaminPos);
  });

  it("throws on an unknown primary slug", () => {
    expect(() => buildResultView(scores, "nottribe", null, [])).toThrow();
  });
});
