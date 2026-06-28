import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { rankTribes, type RankedTribe } from "./result";
import type { TribeScore } from "./score";

/** Build a score table over all 12 tribes, defaulting unspecified ones to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("rankTribes", () => {
  it("returns all 12 tribes", () => {
    const ranked = rankTribes(tableFrom({}));
    expect(ranked).toHaveLength(12);
    expect(new Set(ranked.map((r) => r.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
  });

  it("orders the tribes by descending normalized score", () => {
    const ranked = rankTribes(
      tableFrom({ judah: 0.2, dan: 0.9, benjamin: 0.5 }),
    );
    const scores = ranked.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked[0].slug).toBe("dan");
    expect(ranked[1].slug).toBe("benjamin");
    expect(ranked[2].slug).toBe("judah");
  });

  it("attaches each tribe's accent color name from the source of truth", () => {
    const ranked = rankTribes(tableFrom({ judah: 1 }));
    const judah = ranked.find((r) => r.slug === "judah")!;
    const source = tribes.find((t) => t.slug === "judah")!;
    expect(judah.color).toBe(source.color);
  });

  it("keeps canonical (tribe number) order for ties so the ranking is deterministic", () => {
    const ranked = rankTribes(tableFrom({}));
    expect(ranked.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("does not mutate the input scores", () => {
    const input = tableFrom({ dan: 0.9, judah: 0.1 });
    const snapshot: RankedTribe[] = input.map((s) => ({ ...s, color: "" }));
    rankTribes(input);
    expect(input.map((s) => s.slug)).toEqual(snapshot.map((s) => s.slug));
  });
});
