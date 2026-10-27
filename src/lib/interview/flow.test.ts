import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { MAX_TURNS, MIN_TURNS } from "./confidence";
import {
  CALIBRATION_QUESTIONS,
  CALIBRATION_TURNS,
  DISCRIMINATION_FALLBACKS,
} from "./funnel";
import {
  applyTurn,
  emptyProfile,
  initialState,
  nextTurn,
  OPENING_QUESTION,
  type ScoredAnswer,
} from "./flow";
import type { InterviewState, InterviewTurn, MarkerDelta } from "./types";

const delta = (tribeSlug: string, value: number): MarkerDelta => ({
  markerId: `${tribeSlug}-m`,
  tribeSlug,
  type: "strength",
  delta: value,
  postureSignal: "neutral",
});

/** A Turn that clearly favours Judah, with Levi a close Contender and Dan well behind. */
const decisive: ScoredAnswer = {
  deltas: [delta("judah", 4), delta("levi", 3.2), delta("dan", 1)],
  nextQuestion: "Next?",
};

/** A Turn that leaves Judah and Levi inseparable (a persistent tie). */
const tied: ScoredAnswer = {
  deltas: [delta("judah", 2), delta("levi", 2)],
  nextQuestion: "Next?",
};

/** Build the completed Turn implied by the current pending turn, then fold it in. */
function answer(state: InterviewState, text: string, scored: ScoredAnswer): InterviewState {
  const pending = state.pendingTurn;
  let turn: InterviewTurn;
  if (pending?.kind === "dilemma") {
    const { id, pair, optionA, optionB } = pending.dilemma;
    turn = { question: pending.dilemma.prompt, answer: text, dilemma: { id, pair, optionA, optionB, choice: "A" } };
  } else {
    turn = { question: pending?.prompt ?? "", answer: text };
  }
  return applyTurn(state, turn, scored);
}

function run(turns: number, scored: ScoredAnswer): InterviewState {
  let state = initialState();
  for (let i = 0; i < turns; i++) state = answer(state, `answer ${i}`, scored);
  return state;
}

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
    }
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns, asking the opening Calibration question", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(nextTurn(state)).toEqual({
      kind: "question",
      phase: "calibration",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
    });
  });
});

describe("applyTurn", () => {
  it("records the answer against the question that was pending", () => {
    const state = answer(initialState(), "I was teaching a friend to climb.", decisive);
    expect(state.turns).toEqual([
      { question: OPENING_QUESTION, answer: "I was teaching a friend to climb." },
    ]);
  });

  it("applies the scored deltas and traces them to the Turn", () => {
    const state = answer(initialState(), "a", decisive);
    expect(state.profile.judah).toBe(4);
    expect(state.trace.map((t) => t.turnIndex)).toEqual([0, 0, 0]);
  });

  it("runs the fixed Calibration opening before any narrowing, ignoring model proposals", () => {
    let state = initialState();
    const asked = [state.pendingTurn];
    for (let i = 0; i < CALIBRATION_TURNS - 1; i++) {
      // A lopsided, decisive answer must NOT shortcut the fixed opening.
      state = answer(state, `a${i}`, decisive);
      asked.push(state.pendingTurn);
    }
    expect(asked.map((p) => (p?.kind === "question" ? p.prompt : "dilemma"))).toEqual(
      CALIBRATION_QUESTIONS.slice(0, CALIBRATION_TURNS),
    );
    for (const p of asked) {
      expect(p?.kind === "question" && p.phase).toBe("calibration");
    }
  });

  it("queues the agent's steered question during Discrimination", () => {
    let state = run(CALIBRATION_TURNS, decisive);
    state = answer(state, "a", { ...decisive, nextQuestion: "What drains you?" });
    expect(nextTurn(state)).toMatchObject({
      kind: "question",
      phase: "discrimination",
      prompt: "What drains you?",
    });
  });

  it("falls back to an authored Discrimination question when the agent proposes none", () => {
    let state = run(CALIBRATION_TURNS, decisive);
    state = answer(state, "a", { ...decisive, nextQuestion: null });
    expect(state.pendingTurn?.kind).toBe("question");
    if (state.pendingTurn?.kind === "question") {
      expect(state.pendingTurn.phase).toBe("discrimination");
      expect(DISCRIMINATION_FALLBACKS).toContain(state.pendingTurn.prompt);
    }
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    answer(before, "an answer", decisive);
    expect(before.turns).toEqual([]);
    expect(before.profile.judah).toBe(0);
  });

  it("keeps asking until the minimum floor, then stops with a Primary and Contenders", () => {
    const early = run(MIN_TURNS - 1, decisive);
    expect(early.status).toBe("in_progress");

    const done = run(MIN_TURNS, decisive);
    expect(done.status).toBe("complete");
    expect(nextTurn(done)).toEqual({ kind: "result" });
    expect(done.result?.primary).toEqual(["judah"]);
    expect(done.result?.contenders).toEqual(["judah", "levi"]);
  });

  it("runs to the cap and reports Co-Primaries when the top tribes never separate", () => {
    expect(run(MAX_TURNS - 1, tied).status).toBe("in_progress");
    const done = run(MAX_TURNS, tied);
    expect(done.status).toBe("complete");
    expect(done.turns).toHaveLength(MAX_TURNS);
    expect(done.result?.coPrimary).toBe(true);
    expect(done.result?.primary).toEqual(["judah", "levi"]);
  });

  it("deploys a Dilemma on a stubborn tie but never two in a row", () => {
    let state = initialState();
    const kinds: string[] = [];
    for (let i = 0; i < MAX_TURNS - 1; i++) {
      state = answer(state, `a${i}`, tied);
      if (state.pendingTurn) kinds.push(state.pendingTurn.kind);
    }
    expect(kinds).toContain("dilemma");
    for (let i = 1; i < kinds.length; i++) {
      expect(kinds[i] === "dilemma" && kinds[i - 1] === "dilemma").toBe(false);
    }
  });

  it("is a no-op once the session is already complete", () => {
    const complete = run(MIN_TURNS, decisive);
    expect(answer(complete, "more", decisive)).toBe(complete);
  });
});
