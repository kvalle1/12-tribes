import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { ASSESSMENT_PAGES, isCompletePagedSelection, shuffledPages } from "./pages";

describe("assessment pages", () => {
  it("has 5 pages of 12 unique known words", () => {
    expect(ASSESSMENT_PAGES).toHaveLength(5);
    const all = ASSESSMENT_PAGES.flat();
    expect(all).toHaveLength(60);
    expect(new Set(all).size).toBe(60);
    const known = new Set(WORDS.map((w) => w.word));
    for (const w of all) expect(known.has(w)).toBe(true);
    for (const p of ASSESSMENT_PAGES) expect(p).toHaveLength(tribes.length);
  });

  it("shuffles within pages without changing membership", () => {
    shuffledPages().forEach((p, i) =>
      expect([...p].sort()).toEqual([...ASSESSMENT_PAGES[i]].sort()),
    );
  });

  it("accepts exactly 3 per page and rejects anything else", () => {
    const good = ASSESSMENT_PAGES.flatMap((p) => p.slice(0, 3));
    expect(isCompletePagedSelection(good)).toBe(true);
    expect(isCompletePagedSelection(good.slice(1))).toBe(false);
    expect(isCompletePagedSelection([...good, ASSESSMENT_PAGES[0][5]])).toBe(false);
    // 15 words but 4 from page 0 and 2 from page 1
    expect(isCompletePagedSelection([...good.filter((w) => w !== good[3]), ASSESSMENT_PAGES[0][5]])).toBe(false);
    expect(isCompletePagedSelection([...good.slice(1), good[1]])).toBe(false);
    expect(isCompletePagedSelection([...good.slice(1), "Nope"])).toBe(false);
  });
});
