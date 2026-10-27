import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  CALIBRATION_QUESTIONS,
  CALIBRATION_TURNS,
  DILEMMA_TIE_TURNS,
  isNeutralPhrasing,
  phaseFor,
  planNextTurn,
  previewPlan,
  type FunnelState,
} from "./funnel";
import type { InterviewTurn, ScoreTraceEntry, StrengthProfile } from "./types";

/** A trace that awards `perTurn[turn]` to each tribe on that turn. */
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

/** Build a Session-shaped state from per-turn scores, all as plain questions. */
function stateOf(
  perTurn: Record<string, number>[],
  turnOverrides: Partial<InterviewTurn>[] = [],
): FunnelState {
  const trace = traceOf(perTurn);
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  for (const entry of trace) profile[entry.tribeSlug] += entry.delta;
  const turns = perTurn.map((_, i) => ({ question: `q${i}`, answer: `a${i}`, ...turnOverrides[i] }));
  return { profile, trace, turns };
}

const repeat = <T,>(n: number, value: T): T[] => Array.from({ length: n }, () => value);

/** Enough Turns to be past Calibration, with Judah leading clearly. */
const pastCalibration = (extra: number, scores: Record<string, number>) =>
  stateOf(repeat(CALIBRATION_TURNS + extra, scores));

describe("Calibration (fixed broad opening)", () => {
  it("asks the authored Calibration questions first, in order", () => {
    for (let i = 0; i < CALIBRATION_TURNS; i++) {
      const plan = planNextTurn(stateOf(repeat(i, { judah: 5 })));
      expect(plan).toEqual({ phase: "calibration", kind: "question", prompt: CALIBRATION_QUESTIONS[i] });
    }
  });

  it("runs Calibration before any narrowing, however lopsided the early answers", () => {
    // A runaway leader after one answer must not short-circuit the opening.
    const plan = planNextTurn(stateOf([{ judah: 10 }]));
    expect(plan.phase).toBe("calibration");
  });

  it("switches to Discrimination once Calibration is complete", () => {
    expect(phaseFor(CALIBRATION_TURNS - 1)).toBe("calibration");
    expect(phaseFor(CALIBRATION_TURNS)).toBe("discrimination");
    expect(planNextTurn(pastCalibration(0, { judah: 3, levi: 2 })).phase).toBe("discrimination");
  });

  it("is a broad opening of more than one question", () => {
    expect(CALIBRATION_TURNS).toBeGreaterThan(1);
  });
});

describe("Discrimination targeting (demote the leader)", () => {
  it("aims to demote the leader rather than confirm it", () => {
    const plan = planNextTurn(pastCalibration(0, { judah: 4, levi: 3.2, dan: 1 }));
    expect(plan.phase).toBe("discrimination");
    if (plan.phase !== "discrimination") return;
    expect(plan.target?.demote).toBe("judah");
    expect(plan.target?.promote).not.toContain("judah");
  });

  it("promotes the live Contenders and a dark horse from outside the band", () => {
    const plan = planNextTurn(pastCalibration(0, { judah: 4, levi: 3.2, dan: 1 }));
    if (plan.phase !== "discrimination") throw new Error("expected discrimination");
    // levi is a live Contender; dan is the strongest tribe outside the band.
    expect(plan.target?.promote).toEqual(["levi", "dan"]);
  });

  it("only names a dark horse that has some evidence", () => {
    const plan = planNextTurn(pastCalibration(0, { judah: 4, levi: 3.2 }));
    if (plan.phase !== "discrimination") throw new Error("expected discrimination");
    expect(plan.target?.promote).toEqual(["levi"]);
  });

  it("still names a dark horse when the leader stands alone", () => {
    const plan = planNextTurn(pastCalibration(0, { judah: 4, gad: 1 }));
    if (plan.phase !== "discrimination") throw new Error("expected discrimination");
    expect(plan.target).toEqual({ demote: "judah", promote: ["gad"] });
  });

  it("has no target when nothing has scored yet", () => {
    const plan = planNextTurn(pastCalibration(0, {}));
    if (plan.phase !== "discrimination") throw new Error("expected discrimination");
    expect(plan.target).toBeNull();
    expect(plan.kind).toBe("question");
  });
});

describe("Dilemma (stubborn tie only)", () => {
  const tied = { judah: 2, levi: 2, dan: 0.5 };

  it("triggers when the same two Contenders stay inseparable over recent Discrimination Turns", () => {
    const plan = planNextTurn(pastCalibration(DILEMMA_TIE_TURNS, tied));
    expect(plan).toMatchObject({ phase: "discrimination", kind: "dilemma", pair: ["judah", "levi"] });
  });

  it("does not trigger on a clear leader", () => {
    expect(planNextTurn(pastCalibration(2, { judah: 4, levi: 2 })).kind).toBe("question");
  });

  it("does not trigger on a tie that has only just formed", () => {
    // Judah leads clearly, then Levi draws level on the latest Turn only.
    const perTurn = [...repeat(CALIBRATION_TURNS, { judah: 3, levi: 1 }), { levi: 8 }];
    expect(planNextTurn(stateOf(perTurn)).kind).toBe("question");
  });

  it("does not trigger during Calibration, even on a tie", () => {
    expect(planNextTurn(stateOf(repeat(CALIBRATION_TURNS - 1, tied))).kind).toBe("question");
  });

  it("does not count Calibration Turns toward the tie", () => {
    // Tied all through Calibration, but no targeted question has tried to break it yet.
    expect(planNextTurn(pastCalibration(DILEMMA_TIE_TURNS - 1, tied)).kind).toBe("question");
  });

  it("needs the tie to hold for the full window", () => {
    expect(DILEMMA_TIE_TURNS).toBeGreaterThan(1);
  });

  it("does not ask two Dilemmas in a row", () => {
    const n = CALIBRATION_TURNS + DILEMMA_TIE_TURNS + 1;
    const turns = repeat<Partial<InterviewTurn>>(n, {});
    turns[n - 1] = { dilemma: { situationA: "x", situationB: "y" }, choice: "A" };
    expect(planNextTurn(stateOf(repeat(n, tied), turns)).kind).toBe("question");
  });
});

describe("previewPlan (the brief sent with the scoring call)", () => {
  it("plans for the Turn after the pending answer", () => {
    // With CALIBRATION_TURNS - 1 answered, the pending answer is the last
    // Calibration Turn, so the Turn after it opens Discrimination.
    const state = stateOf(repeat(CALIBRATION_TURNS - 1, { judah: 3, levi: 1 }));
    expect(planNextTurn(state).phase).toBe("calibration");
    expect(previewPlan(state).phase).toBe("discrimination");
  });

  it("asks for a Dilemma draft when the tie would become stubborn if this answer keeps it", () => {
    const state = pastCalibration(DILEMMA_TIE_TURNS - 1, { judah: 2, levi: 2 });
    expect(planNextTurn(state).kind).toBe("question");
    expect(previewPlan(state)).toMatchObject({ kind: "dilemma", pair: ["judah", "levi"] });
  });
});

describe("isNeutralPhrasing", () => {
  it("accepts a neutral situation/behaviour prompt", () => {
    expect(isNeutralPhrasing("Tell me about a time a plan fell apart. What did you do next?")).toBe(true);
  });

  it("rejects text that names a tribe", () => {
    expect(isNeutralPhrasing("Do you relate to Judah's courage?")).toBe(false);
    expect(isNeutralPhrasing("Would a levi-style priest do this?")).toBe(false);
  });

  it("matches whole words only", () => {
    // "Dan" inside "danger" or "Gad" inside "gadget" is not a tribe reference.
    expect(isNeutralPhrasing("What danger would you walk toward with only a gadget?")).toBe(true);
  });

  it("holds for every authored Calibration question", () => {
    for (const q of CALIBRATION_QUESTIONS) expect(isNeutralPhrasing(q)).toBe(true);
  });
});
