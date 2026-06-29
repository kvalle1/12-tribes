import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";
import { rankByScore, resolveHeadline } from "./result";

/** Build a score table from per-slug overrides, defaulting the rest to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankByScore", () => {
  it("orders all tribes highest score first", () => {
    const ranked = rankByScore(
      tableFrom({ dan: 0.3, judah: 0.9, levi: 0.6 }),
    );
    expect(ranked).toHaveLength(12);
    expect(ranked.slice(0, 3).map((s) => s.slug)).toEqual([
      "judah",
      "levi",
      "dan",
    ]);
  });

  it("keeps canonical (tribe number) order for ties", () => {
    // Every tribe at the same score → the input order is preserved.
    const ranked = rankByScore(tableFrom({}));
    expect(ranked.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("does not mutate its input", () => {
    const input = tableFrom({ benjamin: 0.5, judah: 0.2 });
    const snapshot = input.map((s) => s.slug);
    rankByScore(input);
    expect(input.map((s) => s.slug)).toEqual(snapshot);
  });
});

describe("resolveHeadline", () => {
  it("resolves the primary slug to its full Tribe", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.name).toBe("Judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a secondary slug when present", () => {
    const { secondary } = resolveHeadline("judah", "dan");
    expect(secondary?.slug).toBe("dan");
  });

  it("treats a null secondary slug as no secondary", () => {
    expect(resolveHeadline("judah", null).secondary).toBeUndefined();
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nope")).toThrow();
  });
});
