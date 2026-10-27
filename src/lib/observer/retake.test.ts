import { describe, it, expect } from "vitest";
import { partitionByRetake } from "./retake";

const at = (iso: string) => new Date(iso);

describe("partitionByRetake", () => {
  const takenAt = at("2026-10-01T12:00:00Z");

  it("keeps responses recorded after the current result was taken", () => {
    const later = { words: ["bold"], createdAt: at("2026-10-02T00:00:00Z") };
    expect(partitionByRetake([later], takenAt)).toEqual({
      current: [later],
      staleCount: 0,
    });
  });

  it("excludes responses recorded before a retake and counts them as stale", () => {
    const earlier = { words: ["calm"], createdAt: at("2026-09-30T00:00:00Z") };
    const later = { words: ["bold"], createdAt: at("2026-10-02T00:00:00Z") };
    expect(partitionByRetake([earlier, later], takenAt)).toEqual({
      current: [later],
      staleCount: 1,
    });
  });

  it("treats a response recorded at the exact retake instant as current", () => {
    const same = { words: ["bold"], createdAt: at("2026-10-01T12:00:00Z") };
    expect(partitionByRetake([same], takenAt).current).toEqual([same]);
  });

  it("preserves the input order of current responses", () => {
    const a = { words: ["a"], createdAt: at("2026-10-03T00:00:00Z") };
    const b = { words: ["b"], createdAt: at("2026-09-01T00:00:00Z") };
    const c = { words: ["c"], createdAt: at("2026-10-02T00:00:00Z") };
    expect(partitionByRetake([a, b, c], takenAt).current).toEqual([a, c]);
  });

  it("returns nothing for a Subject with no responses", () => {
    expect(partitionByRetake([], takenAt)).toEqual({
      current: [],
      staleCount: 0,
    });
  });
});
