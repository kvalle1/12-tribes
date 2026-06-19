import { describe, expect, it } from "vitest";
import { rowToSession, sessionToInsert, type SessionRow } from "./interview-mappers";
import { recordAnswer, startSession } from "@/lib/interview/session";

const NOW = new Date("2026-06-19T12:00:00.000Z");

/** Build the row a Session would round-trip to (all columns populated). */
function rowFor(session: ReturnType<typeof startSession>): SessionRow {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    turns: session.turns,
    pendingPrompt: session.pendingPrompt,
    profile: session.profile,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

describe("interview-mappers", () => {
  it("sessionToInsert carries every domain field into the row values", () => {
    const session = startSession({ id: "s1", userId: "u1", now: NOW });

    expect(sessionToInsert(session)).toEqual({
      id: "s1",
      userId: "u1",
      status: "in_progress",
      turns: [],
      pendingPrompt: session.pendingPrompt,
      profile: {},
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("rowToSession reconstructs the domain Session from a row", () => {
    const session = startSession({ id: "s1", userId: "u1", now: NOW });

    expect(rowToSession(rowFor(session))).toEqual(session);
  });

  it("preserves turn history and the completed status through a row round-trip", () => {
    const completed = recordAnswer(
      startSession({ id: "s2", userId: "u2", now: NOW }),
      "An answer.",
      NOW,
    );

    const restored = rowToSession(rowFor(completed));

    expect(restored.status).toBe("complete");
    expect(restored.pendingPrompt).toBeNull();
    expect(restored.turns).toEqual(completed.turns);
  });
});
