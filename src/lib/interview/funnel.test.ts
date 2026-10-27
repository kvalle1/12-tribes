import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  CALIBRATION_QUESTIONS,
  CALIBRATION_TURNS,
  contenderTargets,
  OPENING_QUESTION,
  phaseFor,
  pickDilemma,
  planNextTurn,
  stubbornTie,
} from "./funnel";
import type { ScoreTraceEntry, StrengthProfile } from "./types";

/** A zeroed 12-tribe profile, then raised per the given slug→score map. */
function profile(scores: Record<string, number>): StrengthProfile {
  const p: StrengthProfile = {};
  for (const tribe of tribes) p[tribe.slug] = scores[tribe.slug] ?? 0;
  return p;
}

/** Build a trace where each listed turn adds the given per-tribe deltas. */
function trace(turns: Record<string, number>[]): ScoreTraceEntry[] {
  return turns.flatMap((deltas, turnIndex) =>
    Object.entries(deltas).map(([tribeSlug, delta]) => ({
      turnIndex,
      markerId: `${tribeSlug}-m`,
      tribeSlug,
      type: "strength" as const,
      delta,
      postureSignal: "neutral" as const,
    })),
  );
}

describe("phaseFor (Calibration precedes Discrimination)", () => {
  it("is Calibration for the fixed opening turns, then Discrimination", () => {
    for (let n = 0; n < CALIBRATION_TURNS; n++) {
      expect(phaseFor(n)).toBe("calibration");
    }
    expect(phaseFor(CALIBRATION_TURNS)).toBe("discrimination");
    expect(phaseFor(CALIBRATION_TURNS + 5)).toBe("discrimination");
  });

  it("has at least CALIBRATION_TURNS authored opening questions, starting with the opener", () => {
    expect(CALIBRATION_QUESTIONS.length).toBeGreaterThanOrEqual(CALIBRATION_TURNS);
    expect(CALIBRATION_QUESTIONS[0]).toBe(OPENING_QUESTION);
  });
});

describe("planNextTurn — Calibration runs first as a fixed broad opening", () => {
  it("serves the fixed Calibration questions in order, ignoring any model proposal", () => {
    for (let turnsCompleted = 0; turnsCompleted < CALIBRATION_TURNS; turnsCompleted++) {
      const plan = planNextTurn({
        turnsCompleted,
        profile: profile({ judah: 99 }), // a lopsided profile must NOT trigger narrowing yet
        trace: [],
        lastTurnWasDilemma: false,
        proposedQuestion: "a narrowing model question",
      });
      expect(plan).toEqual({
        kind: "question",
        phase: "calibration",
        prompt: CALIBRATION_QUESTIONS[turnsCompleted],
      });
    }
  });
});

describe("planNextTurn — Discrimination", () => {
  const spread = profile({ judah: 10, levi: 4, dan: 2 });

  it("asks the model's steered question once Calibration is done", () => {
    const plan = planNextTurn({
      turnsCompleted: CALIBRATION_TURNS,
      profile: spread,
      trace: [],
      lastTurnWasDilemma: false,
      proposedQuestion: "A neutral separating question.",
    });
    expect(plan).toEqual({
      kind: "question",
      phase: "discrimination",
      prompt: "A neutral separating question.",
    });
  });

  it("falls back to an authored neutral question when the model proposes none", () => {
    const plan = planNextTurn({
      turnsCompleted: CALIBRATION_TURNS,
      profile: spread,
      trace: [],
      lastTurnWasDilemma: false,
      proposedQuestion: null,
    });
    expect(plan.kind).toBe("question");
    if (plan.kind === "question") {
      expect(plan.phase).toBe("discrimination");
      expect(plan.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("contenderTargets (demote-the-leader targeting)", () => {
  it("names the leader to demote and a dark horse to promote", () => {
    const targets = contenderTargets(profile({ judah: 10, levi: 9, dan: 1 }));
    expect(targets.leader).toBe("judah");
    // levi is within the Contender band of judah, so it is the dark horse to promote.
    expect(targets.contenders).toEqual(["judah", "levi"]);
    expect(targets.darkHorse).toBe("levi");
  });

  it("has no leader or dark horse before anything has scored", () => {
    const targets = contenderTargets(profile({}));
    expect(targets.leader).toBeNull();
    expect(targets.darkHorse).toBeNull();
  });
});

describe("stubbornTie (Dilemma only triggers on a stubborn tie)", () => {
  // judah and levi stay neck-and-neck every turn; dan trails.
  const stuck = trace([
    { judah: 2, levi: 2, dan: 1 },
    { judah: 2, levi: 2, dan: 1 },
    { judah: 2, levi: 2, dan: 1 },
    { judah: 2, levi: 2, dan: 1 },
    { judah: 2, levi: 2, dan: 1 },
    { judah: 2, levi: 2, dan: 1 },
  ]);

  it("returns the tied Contender pair when the tie is stubborn in Discrimination", () => {
    const pair = stubbornTie(profile({ judah: 12, levi: 12, dan: 6 }), stuck, 6);
    expect(pair).toEqual(["judah", "levi"]);
  });

  it("returns null when the leader is clearly ahead (no tie)", () => {
    const clear = trace([
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
    ]);
    expect(stubbornTie(profile({ judah: 18, levi: 6 }), clear, 6)).toBeNull();
  });

  it("returns null during Calibration even if the top two are tied", () => {
    expect(stubbornTie(profile({ judah: 2, levi: 2 }), stuck, CALIBRATION_TURNS - 1)).toBeNull();
  });

  it("returns null for a fresh tie that has not persisted (not stubborn)", () => {
    // Clear leader for most of the run; levi only pulls level on the final turn.
    const lateTie = trace([
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 3, levi: 1 },
      { judah: 1, levi: 11 },
    ]);
    // Now tied overall, but the tie is one turn old, not stubborn.
    expect(stubbornTie(profile({ judah: 16, levi: 16 }), lateTie, 6)).toBeNull();
  });
});

describe("planNextTurn — Dilemma on a stubborn tie", () => {
  const stuck = trace(
    Array.from({ length: 6 }, () => ({ judah: 2, levi: 2, dan: 1 })),
  );
  const tiedProfile = profile({ judah: 12, levi: 12, dan: 6 });

  it("deploys a Dilemma for the tied pair during Discrimination", () => {
    const plan = planNextTurn({
      turnsCompleted: 6,
      profile: tiedProfile,
      trace: stuck,
      lastTurnWasDilemma: false,
      proposedQuestion: "a question",
    });
    expect(plan.kind).toBe("dilemma");
    if (plan.kind === "dilemma") {
      expect(plan.dilemma.pair).toEqual(["judah", "levi"]);
    }
  });

  it("does not deploy a Dilemma immediately after another Dilemma", () => {
    const plan = planNextTurn({
      turnsCompleted: 6,
      profile: tiedProfile,
      trace: stuck,
      lastTurnWasDilemma: true,
      proposedQuestion: "a free-text question",
    });
    expect(plan.kind).toBe("question");
  });
});

describe("pickDilemma (tribe-unlabelled options)", () => {
  const tribeNames = tribes.map((t) => t.name.toLowerCase());
  const tribeSlugs = tribes.map((t) => t.slug);

  function assertUnlabelled(text: string) {
    const haystack = text.toLowerCase();
    for (const name of tribeNames) expect(haystack).not.toContain(name);
    for (const slug of tribeSlugs) expect(haystack).not.toContain(slug);
  }

  it("returns a dilemma whose prompt and both options carry no tribe label", () => {
    const d = pickDilemma(["judah", "levi"]);
    expect(d.pair).toEqual(["judah", "levi"]);
    assertUnlabelled(d.prompt);
    assertUnlabelled(d.optionA);
    assertUnlabelled(d.optionB);
  });

  it("falls back to a generic (still unlabelled) dilemma for an unauthored pair", () => {
    const d = pickDilemma(["reuben", "zebulun"]);
    expect(d.pair).toEqual(["reuben", "zebulun"]);
    expect(d.optionA.length).toBeGreaterThan(0);
    expect(d.optionB.length).toBeGreaterThan(0);
    assertUnlabelled(d.prompt);
    assertUnlabelled(d.optionA);
    assertUnlabelled(d.optionB);
  });

  it("normalizes the pair order so lookup is independent of argument order", () => {
    expect(pickDilemma(["levi", "judah"]).id).toBe(pickDilemma(["judah", "levi"]).id);
  });
});
