import { describe, expect, it } from "vitest";
import {
  FIRST_QUESTION,
  InterviewError,
  presentView,
  recordAnswer,
  startSession,
  type InterviewSession,
} from "./session";

const NOW = new Date("2026-06-19T12:00:00.000Z");
const LATER = new Date("2026-06-19T12:05:00.000Z");

function fresh(): InterviewSession {
  return startSession({ id: "session-1", userId: "user-1", now: NOW });
}

describe("startSession", () => {
  it("opens an in-progress session with the first question pending and no turns", () => {
    const session = fresh();

    expect(session.id).toBe("session-1");
    expect(session.userId).toBe("user-1");
    expect(session.status).toBe("in_progress");
    expect(session.turns).toEqual([]);
    expect(session.pendingPrompt).toBe(FIRST_QUESTION);
  });

  it("starts with an empty running profile (scoring is deferred to a later slice)", () => {
    expect(fresh().profile).toEqual({});
  });
});

describe("presentView", () => {
  it("shows the pending question with its turn index for a fresh session", () => {
    const view = presentView(fresh());

    expect(view).toEqual({
      kind: "question",
      index: 0,
      prompt: FIRST_QUESTION,
      answeredCount: 0,
    });
  });

  it("shows completion once the interview has finished", () => {
    const answered = recordAnswer(fresh(), "I felt focused and useful.", LATER);

    expect(presentView(answered)).toEqual({ kind: "complete", answeredCount: 1 });
  });

  it("never exposes server-only scoring state to the participant view", () => {
    const view = presentView(fresh());

    expect(view).not.toHaveProperty("profile");
    expect(view).not.toHaveProperty("turns");
  });
});

describe("recordAnswer", () => {
  it("appends a turn pairing the pending prompt with the answer", () => {
    const answered = recordAnswer(fresh(), "I rallied people to a hard goal.", LATER);

    expect(answered.turns).toEqual([
      { index: 0, prompt: FIRST_QUESTION, answer: "I rallied people to a hard goal." },
    ]);
    expect(answered.updatedAt).toBe(LATER);
  });

  it("completes the (single-question) skeleton interview after one answer", () => {
    const answered = recordAnswer(fresh(), "Some answer.", LATER);

    expect(answered.status).toBe("complete");
    expect(answered.pendingPrompt).toBeNull();
  });

  it("trims surrounding whitespace from the stored answer", () => {
    const answered = recordAnswer(fresh(), "   trimmed me   ", LATER);

    expect(answered.turns[0].answer).toBe("trimmed me");
  });

  it("does not mutate the input session", () => {
    const session = fresh();
    recordAnswer(session, "Some answer.", LATER);

    expect(session.turns).toEqual([]);
    expect(session.status).toBe("in_progress");
    expect(session.pendingPrompt).toBe(FIRST_QUESTION);
  });

  it("rejects an empty or whitespace-only answer", () => {
    expect(() => recordAnswer(fresh(), "   ", LATER)).toThrow(InterviewError);
  });

  it("rejects answering an already-complete interview", () => {
    const complete = recordAnswer(fresh(), "Some answer.", LATER);

    expect(() => recordAnswer(complete, "Another answer.", LATER)).toThrow(
      InterviewError,
    );
  });
});
