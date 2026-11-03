import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { MAX_TURNS, MIN_TURNS } from "./confidence";
import {
  applyTurn,
  emptyProfile,
  FALLBACK_QUESTIONS,
  initialState,
  nextTurn,
  OPENING_QUESTION,
  type ScoredAnswer,
} from "./flow";
import {
  CALIBRATION_QUESTIONS,
  CALIBRATION_TURNS,
  DILEMMA_PROMPT,
  DILEMMA_TIE_TURNS,
} from "./funnel";

/** Enough Turns for a tie to have held through the Dilemma window. */
const TIE_WINDOW = CALIBRATION_TURNS + DILEMMA_TIE_TURNS;
import type { Dilemma, InterviewState, MarkerDelta } from "./types";

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

/** A Turn that leaves Judah and Levi inseparable. */
const tied: ScoredAnswer = {
  deltas: [delta("judah", 2), delta("levi", 2)],
  nextQuestion: "Next?",
};

function run(turns: number, scored: ScoredAnswer): InterviewState {
  let state = initialState();
  for (let i = 0; i < turns; i++) state = applyTurn(state, `answer ${i}`, scored, "A");
  return state;
}

const dilemma: Dilemma = {
  situationA: "Stay late to finish the plan yourself.",
  situationB: "Hand it off and protect the team's evening.",
};

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
  it("starts in progress with no turns, asking the opening question", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
    });
  });
});

describe("applyTurn", () => {
  it("records the answer against the question that was pending", () => {
    const state = applyTurn(initialState(), "I was teaching a friend to climb.", decisive);
    expect(state.turns).toEqual([
      { question: OPENING_QUESTION, answer: "I was teaching a friend to climb." },
    ]);
  });

  it("applies the scored deltas and traces them to the Turn", () => {
    const state = applyTurn(initialState(), "a", decisive);
    expect(state.profile.judah).toBe(4);
    expect(state.trace.map((t) => t.turnIndex)).toEqual([0, 0, 0]);
  });

  it("asks the fixed Calibration questions first, ignoring the agent's proposal", () => {
    let state = initialState();
    for (let i = 1; i < CALIBRATION_TURNS; i++) {
      state = applyTurn(state, "a", { ...decisive, nextQuestion: "Agent question?" });
      expect(state.pendingQuestion).toBe(CALIBRATION_QUESTIONS[i]);
    }
  });

  it("queues the agent's proposed question once Discrimination begins", () => {
    const state = run(CALIBRATION_TURNS - 1, decisive);
    const next = applyTurn(state, "a", { ...decisive, nextQuestion: "What drains you?" });
    expect(nextTurn(next)).toEqual({
      kind: "question",
      prompt: "What drains you?",
      questionNumber: CALIBRATION_TURNS + 1,
    });
  });

  it("falls back to an authored question when the agent proposes none", () => {
    const state = run(CALIBRATION_TURNS - 1, decisive);
    const next = applyTurn(state, "a", { ...decisive, nextQuestion: null });
    expect(next.pendingQuestion).toBe(FALLBACK_QUESTIONS[(CALIBRATION_TURNS - 1) % FALLBACK_QUESTIONS.length]);
  });

  it("queues a Dilemma when a stubborn tie persists and the agent drafted one", () => {
    const state = run(TIE_WINDOW, { ...tied, dilemma });
    expect(nextTurn(state)).toEqual({
      kind: "dilemma",
      prompt: DILEMMA_PROMPT,
      dilemma,
      questionNumber: TIE_WINDOW + 1,
    });
  });

  it("does not queue a Dilemma without a stubborn tie, even if one was drafted", () => {
    const state = run(CALIBRATION_TURNS, { ...decisive, dilemma });
    expect(state.pendingDilemma).toBeNull();
  });

  it("falls back to a question when a tie calls for a Dilemma but none was drafted", () => {
    const state = run(TIE_WINDOW, tied);
    expect(state.pendingDilemma).toBeNull();
    expect(nextTurn(state)).toMatchObject({ kind: "question", prompt: "Next?" });
  });

  it("records a Dilemma answer with its situations, the choice, and the reasoning", () => {
    const pending = run(TIE_WINDOW, { ...tied, dilemma });
    const next = applyTurn(pending, "Because people matter more than plans.", tied, "B");
    expect(next.turns.at(-1)).toEqual({
      question: DILEMMA_PROMPT,
      answer: "Because people matter more than plans.",
      dilemma,
      choice: "B",
    });
  });

  it("ignores a Dilemma answer that has no choice", () => {
    const pending = run(TIE_WINDOW, { ...tied, dilemma });
    expect(applyTurn(pending, "why", tied)).toBe(pending);
  });

  it("never asks two Dilemmas in a row", () => {
    const pending = run(TIE_WINDOW, { ...tied, dilemma });
    const next = applyTurn(pending, "why", { ...tied, dilemma }, "A");
    expect(next.pendingDilemma).toBeNull();
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    applyTurn(before, "an answer", decisive);
    expect(before.turns).toEqual([]);
    expect(before.profile.judah).toBe(0);
  });

  it("routes a matured fall-line to the tribe's oil Marker as it folds the Turn in (ADR-0004)", () => {
    const maturedFall: ScoredAnswer = {
      deltas: [
        { markerId: "judah-fall-power", tribeSlug: "judah", type: "fallLine", delta: 3, postureSignal: "integrated" },
      ],
      nextQuestion: "Next?",
    };
    const state = applyTurn(initialState(), "I used to grab power; I've grown past it.", maturedFall);
    // Strength still rises (maturity is evidence of the tribe, ADR-0004)…
    expect(state.profile.judah).toBe(3);
    // …but the trace records it as the oil Marker with an integrated posture.
    expect(state.trace).toHaveLength(1);
    expect(state.trace[0]).toMatchObject({
      markerId: "judah-oil-responsibility",
      type: "oil",
      postureSignal: "integrated",
      delta: 3,
    });
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

  it("is a no-op once the session is already complete", () => {
    const complete = run(MIN_TURNS, decisive);
    expect(applyTurn(complete, "more", decisive)).toBe(complete);
  });
});
