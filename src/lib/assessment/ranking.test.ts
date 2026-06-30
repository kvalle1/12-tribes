import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { rankBars, type RankedBar } from "./ranking";
import type { TribeScore } from "./score";

/** Build a synthetic score table, defaulting unlisted tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

const widthFor = (slug: string, bars: RankedBar[]) =>
  bars.find((b) => b.slug === slug)!.widthPct;

describe("rankBars", () => {
  it("returns every tribe exactly once", () => {
    const bars = rankBars(tableFrom({}));
    expect(bars).toHaveLength(tribes.length);
    expect(new Set(bars.map((b) => b.slug)).size).toBe(tribes.length);
  });

  it("orders tribes by score, highest first", () => {
    const bars = rankBars(tableFrom({ judah: 0.2, levi: 0.6, dan: 0.4 }));
    expect(bars.map((b) => b.slug).slice(0, 3)).toEqual(["levi", "dan", "judah"]);
  });

  it("keeps canonical (tribe number) order for ties", () => {
    // Every score equal → output should match the canonical tribes order.
    const bars = rankBars(tableFrom({}));
    expect(bars.map((b) => b.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scales the bar widths so the top score fills the track", () => {
    const bars = rankBars(tableFrom({ judah: 0.5, levi: 0.25 }));
    expect(widthFor("judah", bars)).toBe(100);
    expect(widthFor("levi", bars)).toBe(50);
  });

  it("gives every bar zero width when no words were selected", () => {
    const bars = rankBars(tableFrom({}));
    expect(bars.every((b) => b.widthPct === 0)).toBe(true);
  });

  it("preserves the original slug, name, and score on each bar", () => {
    const bars = rankBars(tableFrom({ levi: 0.6 }));
    const levi = bars.find((b) => b.slug === "levi")!;
    expect(levi.name).toBe(tribes.find((t) => t.slug === "levi")!.name);
    expect(levi.score).toBe(0.6);
  });
});
