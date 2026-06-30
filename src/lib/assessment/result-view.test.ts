import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { type TribeScore } from "./score";
import { buildResultView, accentHex } from "./result-view";

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const row = (slug: string, view: ReturnType<typeof buildResultView>) =>
  view.ranking.find((r) => r.slug === slug)!;

describe("buildResultView", () => {
  it("ranks all 12 tribes by normalized score, highest first", () => {
    const view = buildResultView(
      tableFrom({ judah: 0.8, reuben: 0.4, levi: 0.6 }),
      "judah",
      null,
      ["Bold"],
    );
    expect(view.ranking).toHaveLength(12);
    expect(view.ranking[0].slug).toBe("judah");
    expect(view.ranking[1].slug).toBe("levi");
    expect(view.ranking[2].slug).toBe("reuben");
    // scores are monotonically non-increasing down the ranking
    for (let i = 1; i < view.ranking.length; i++) {
      expect(view.ranking[i - 1].score).toBeGreaterThanOrEqual(
        view.ranking[i].score,
      );
    }
  });

  it("breaks score ties by canonical tribe order (matches deriveResult)", () => {
    // judah (#1) and benjamin (#6) tie; judah ranks first by canonical order.
    const view = buildResultView(
      tableFrom({ judah: 0.5, benjamin: 0.5 }),
      "judah",
      "benjamin",
      ["Bold"],
    );
    const judahIdx = view.ranking.findIndex((r) => r.slug === "judah");
    const benjaminIdx = view.ranking.findIndex((r) => r.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });

  it("gives the leader a full bar and scales the rest proportionally", () => {
    const view = buildResultView(
      tableFrom({ judah: 0.8, levi: 0.4, reuben: 0.2 }),
      "judah",
      null,
      ["Bold"],
    );
    expect(row("judah", view).barFraction).toBeCloseTo(1);
    expect(row("levi", view).barFraction).toBeCloseTo(0.5);
    expect(row("reuben", view).barFraction).toBeCloseTo(0.25);
    expect(row("dan", view).barFraction).toBe(0); // unscored tribe
  });

  it("never divides by zero when nothing scored", () => {
    const view = buildResultView(tableFrom({}), "judah", null, []);
    expect(view.ranking.every((r) => r.barFraction === 0)).toBe(true);
    expect(view.ranking.every((r) => Number.isFinite(r.barFraction))).toBe(true);
  });

  it("exposes the normalized score as a rounded display percent", () => {
    const view = buildResultView(
      tableFrom({ judah: 0.834, levi: 0.5 }),
      "judah",
      null,
      ["Bold"],
    );
    expect(row("judah", view).percent).toBe(83);
    expect(row("levi", view).percent).toBe(50);
  });

  it("flags the Primary and Secondary from the stored result slugs", () => {
    const view = buildResultView(
      tableFrom({ judah: 0.9, reuben: 0.8, levi: 0.2 }),
      "judah",
      "reuben",
      ["Bold"],
    );
    expect(view.primary.slug).toBe("judah");
    expect(view.primary.role).toBe("primary");
    expect(view.secondary?.slug).toBe("reuben");
    expect(view.secondary?.role).toBe("secondary");
    expect(row("levi", view).role).toBeUndefined();
  });

  it("omits the Secondary when the stored result has none", () => {
    const view = buildResultView(
      tableFrom({ judah: 0.9, reuben: 0.3 }),
      "judah",
      null,
      ["Bold"],
    );
    expect(view.secondary).toBeUndefined();
    expect(view.ranking.some((r) => r.role === "secondary")).toBe(false);
  });

  it("passes the selected words through unchanged", () => {
    const words = ["Bold", "Courageous", "Loyal"];
    const view = buildResultView(tableFrom({ judah: 1 }), "judah", null, words);
    expect(view.words).toEqual(words);
  });

  it("resolves a per-tribe accent hex for every tribe", () => {
    const view = buildResultView(tableFrom({ judah: 1 }), "judah", null, [
      "Bold",
    ]);
    for (const r of view.ranking) {
      expect(r.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("throws on an unknown primary slug rather than rendering a blank result", () => {
    expect(() =>
      buildResultView(tableFrom({ judah: 1 }), "nottribe", null, ["Bold"]),
    ).toThrow();
  });
});

describe("accentHex", () => {
  it("maps known colors and falls back to brass for unknown ones", () => {
    expect(accentHex("amber")).toBe("#b8860b");
    expect(accentHex("nonsense")).toBe("#a9842f");
  });
});
