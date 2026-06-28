import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { resolveHeadline, resolveRanked } from "./result";

describe("resolveHeadline", () => {
  it("resolves the primary slug to its full Tribe", () => {
    const { primary, secondary } = resolveHeadline("judah");
    expect(primary.slug).toBe("judah");
    expect(primary.name).toBe("Judah");
    expect(secondary).toBeUndefined();
  });

  it("resolves a secondary slug when given", () => {
    const { secondary } = resolveHeadline("judah", "levi");
    expect(secondary?.slug).toBe("levi");
  });

  it("treats a null secondary as no secondary", () => {
    expect(resolveHeadline("judah", null).secondary).toBeUndefined();
  });

  it("throws on an unknown primary slug", () => {
    expect(() => resolveHeadline("nosuchtribe")).toThrow();
  });
});

describe("resolveRanked", () => {
  it("attaches the full Tribe object to each score, preserving order and value", () => {
    const ranked = resolveRanked([
      { slug: "reuben", score: 0.5 },
      { slug: "judah", score: 0.9 },
    ]);
    expect(ranked.map((r) => r.tribe.slug)).toEqual(["reuben", "judah"]);
    expect(ranked[0].score).toBe(0.5);
    expect(ranked[1].tribe.name).toBe("Judah");
  });

  it("resolves every tribe slug in the canonical list", () => {
    const ranked = resolveRanked(tribes.map((t) => ({ slug: t.slug, score: 0 })));
    expect(ranked).toHaveLength(12);
    expect(ranked.every((r) => r.tribe)).toBe(true);
  });

  it("throws on an unknown slug", () => {
    expect(() => resolveRanked([{ slug: "nosuchtribe", score: 0.1 }])).toThrow();
  });
});
