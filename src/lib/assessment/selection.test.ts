import { describe, it, expect } from "vitest";
import { MIN_WORDS, MAX_WORDS } from "./words";
import { normalizeSelection, isSubmittable } from "./selection";

describe("normalizeSelection", () => {
  it("keeps known words in first-seen order", () => {
    expect(normalizeSelection(["Bold", "Courageous", "Wise"])).toEqual([
      "Bold",
      "Courageous",
      "Wise",
    ]);
  });

  it("drops words that are not in the list (exact match, defense-in-depth)", () => {
    expect(normalizeSelection(["Bold", "notaword", "courageous"])).toEqual([
      "Bold",
    ]);
  });

  it("deduplicates while preserving first occurrence", () => {
    expect(normalizeSelection(["Bold", "Bold", "Wise"])).toEqual([
      "Bold",
      "Wise",
    ]);
  });

  it("returns an empty array for an all-invalid selection", () => {
    expect(normalizeSelection(["nope", "", "judah"])).toEqual([]);
  });
});

describe("isSubmittable", () => {
  it("is false below the minimum", () => {
    expect(isSubmittable(MIN_WORDS - 1)).toBe(false);
    expect(isSubmittable(0)).toBe(false);
  });

  it("is true at the boundaries and within range", () => {
    expect(isSubmittable(MIN_WORDS)).toBe(true);
    expect(isSubmittable(MAX_WORDS)).toBe(true);
    expect(isSubmittable(Math.floor((MIN_WORDS + MAX_WORDS) / 2))).toBe(true);
  });

  it("is false above the maximum", () => {
    expect(isSubmittable(MAX_WORDS + 1)).toBe(false);
  });
});
