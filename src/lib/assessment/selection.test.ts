import { describe, expect, it } from "vitest";
import { WORDS } from "./words";
import { isSubmittable, sanitizeSelection } from "./selection";

const realWords = WORDS.slice(0, 3).map((w) => w.word);

describe("sanitizeSelection", () => {
  it("keeps known words, preserving first-seen order", () => {
    expect(sanitizeSelection(realWords)).toEqual(realWords);
  });

  it("drops words that are not in the official list", () => {
    const mixed = [realWords[0], "definitely-not-a-real-word", realWords[1]];
    expect(sanitizeSelection(mixed)).toEqual([realWords[0], realWords[1]]);
  });

  it("removes duplicate selections", () => {
    const dupes = [realWords[0], realWords[0], realWords[1]];
    expect(sanitizeSelection(dupes)).toEqual([realWords[0], realWords[1]]);
  });
});

describe("isSubmittable", () => {
  it("rejects fewer than the minimum (8)", () => {
    expect(isSubmittable(7)).toBe(false);
  });

  it("accepts the inclusive bounds (8 and 15)", () => {
    expect(isSubmittable(8)).toBe(true);
    expect(isSubmittable(15)).toBe(true);
  });

  it("rejects more than the maximum (15)", () => {
    expect(isSubmittable(16)).toBe(false);
  });
});
