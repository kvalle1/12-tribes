import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  evaluate,
  MAX_TURNS,
  MIN_TURNS,
  marginIsDecisive,
  rankingHistory,
  summarize,
} from "./confidence";
import type { ScoreTraceEntry, StrengthProfile } from "./types";

/** A zeroed 12-tribe profile with the given overrides. */
function profileOf(scores: Record<string, number>): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return { ...profile, ...scores };
}

/** A trace that awards `scores[turn]` to each tribe on that turn. */
function traceOf(perTurn: Record<string, number>[]): ScoreTraceEntry[] {
  return perTurn.flatMap((scores, turnIndex) =>
    Object.entries(scores).map(([tribeSlug, delta]) => ({
      turnIndex,
      markerId: `${tribeSlug}-m`,
      tribeSlug,
      type: "strength" as const,
      delta,
      postureSignal: "neutral" as const,
    })),
  );
}

/** Fold a per-turn trace into its final profile. */
function profileFromTrace(trace: ScoreTraceEntry[]): StrengthProfile {
  const profile = profileOf({});
  for (const entry of trace) profile[entry.tribeSlug] += entry.delta;
  return profile;
}

/** `n` turns that each award the same scores — a steady, stable leader. */
function steady(n: number, scores: Record<string, number>) {
  const trace = traceOf(Array.from({ length: n }, () => scores));
  return { profile: profileFromTrace(trace), trace, turnCount: n };
}

describe("summarize", () => {
  it("names the top tribe Primary and bands close tribes as Contenders", () => {
    const summary = summarize(profileOf({ judah: 20, levi: 17, dan: 4 }));
    expect(summary.primary).toEqual(["judah"]);
    expect(summary.contenders).toEqual(["judah", "levi"]);
  });

  it("reports display percentages for every Contender", () => {
    const summary = summarize(profileOf({ judah: 30, levi: 25, dan: 45 }));
    expect(summary.percentages.dan).toBeCloseTo(45);
    expect(summary.percentages.judah).toBeCloseTo(30);
  });

  it("returns no Primary when nothing has scored", () => {
    const summary = summarize(profileOf({}));
    expect(summary.primary).toEqual([]);
    expect(summary.contenders).toEqual([]);
  });
});

describe("marginIsDecisive (relative to evidence)", () => {
  it("rejects a thin early lead", () => {
    // One strong answer: a 3-point lead over nothing is not yet evidence.
    expect(marginIsDecisive(3, 0)).toBe(false);
  });

  it("judges the same absolute gap differently depending on accumulated evidence", () => {
    // An 8-point gap is decisive over modest evidence but noise over a lot of it.
    expect(marginIsDecisive(10, 2)).toBe(true);
    expect(marginIsDecisive(48, 40)).toBe(false);
  });
});

describe("rankingHistory", () => {
  it("replays the trace to give the leader after each Turn", () => {
    const trace = traceOf([{ judah: 3 }, { levi: 5 }, { judah: 4 }]);
    expect(rankingHistory(trace, 3)).toEqual(["judah", "levi", "judah"]);
  });
});

describe("evaluate", () => {
  it("never stops before the minimum floor, however decisive", () => {
    const s = steady(MIN_TURNS - 1, { judah: 10 });
    const verdict = evaluate(s.profile, s.trace, s.turnCount);
    expect(verdict.decision).toBe("continue");
  });

  it("stops once floor, relative margin, and stability all hold", () => {
    const s = steady(MIN_TURNS, { judah: 4, levi: 3, dan: 1 });
    const verdict = evaluate(s.profile, s.trace, s.turnCount);
    expect(verdict.decision).toBe("stop");
    expect(verdict.reason).toBe("confident");
    expect(verdict.result.primary).toEqual(["judah"]);
    expect(verdict.result.contenders).toEqual(["judah", "levi"]);
    expect(verdict.result.coPrimary).toBe(false);
  });

  it("keeps going past the floor while the margin over non-Contenders is thin", () => {
    // Everything is close: the highest non-Contender is barely behind.
    const s = steady(MIN_TURNS, { judah: 1, levi: 0.7, dan: 0.6 });
    expect(evaluate(s.profile, s.trace, s.turnCount).decision).toBe("continue");
  });

  it("requires a stable leader over recent Turns before stopping", () => {
    // Levi led throughout; Judah only took the lead on the final answer.
    const perTurn: Record<string, number>[] = Array.from(
      { length: MIN_TURNS - 1 },
      () => ({ levi: 3, dan: 0.5 }),
    );
    perTurn.push({ judah: 30 });
    const trace = traceOf(perTurn);
    const profile = profileFromTrace(trace);
    const verdict = evaluate(profile, trace, perTurn.length);
    expect(verdict.result.primary).toEqual(["judah"]);
    expect(verdict.decision).toBe("continue");
  });

  it("does not stop before the cap while the top tribes are inseparable", () => {
    const s = steady(MIN_TURNS + 2, { judah: 4, levi: 3.9, dan: 0.5 });
    expect(evaluate(s.profile, s.trace, s.turnCount).decision).toBe("continue");
  });

  it("stops at the hard cap even when unconfident", () => {
    const s = steady(MAX_TURNS, { judah: 1, levi: 0.7, dan: 0.6 });
    const verdict = evaluate(s.profile, s.trace, s.turnCount);
    expect(verdict.decision).toBe("stop");
    expect(verdict.reason).toBe("cap");
  });

  it("reports inseparable top tribes at the cap as Co-Primaries, never a forced winner", () => {
    const s = steady(MAX_TURNS, { judah: 4, levi: 3.9, dan: 0.5 });
    const verdict = evaluate(s.profile, s.trace, s.turnCount);
    expect(verdict.decision).toBe("stop");
    expect(verdict.result.coPrimary).toBe(true);
    expect(verdict.result.primary).toEqual(["judah", "levi"]);
  });

  it("is status-blind: a disqualified tribe can be Primary", () => {
    const disqualified = tribes.find((t) => t.status === "disqualified")!;
    const s = steady(MIN_TURNS, { [disqualified.slug]: 4, levi: 3 });
    const verdict = evaluate(s.profile, s.trace, s.turnCount);
    expect(verdict.decision).toBe("stop");
    expect(verdict.result.primary).toEqual([disqualified.slug]);
  });

  it("every tribe, whatever its status, can be the sole Primary", () => {
    for (const tribe of tribes) {
      const summary = summarize(profileOf({ [tribe.slug]: 10 }));
      expect(summary.primary).toEqual([tribe.slug]);
    }
  });

  it("reports a confidence between 0 and 1", () => {
    const s = steady(MIN_TURNS, { judah: 4, levi: 3, dan: 1 });
    const { confidence } = evaluate(s.profile, s.trace, s.turnCount).result;
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});
