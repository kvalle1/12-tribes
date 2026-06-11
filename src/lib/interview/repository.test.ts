import { describe, expect, it } from "vitest";
import { recordAnswer, startSession } from "./flow";
import { InMemoryInterviewRepository } from "./repository";

describe("InMemoryInterviewRepository", () => {
  it("returns null for an unknown Session id", async () => {
    const repo = new InMemoryInterviewRepository();
    expect(await repo.load("missing")).toBeNull();
  });

  it("persists a created Session so it can be loaded back", async () => {
    const repo = new InMemoryInterviewRepository();
    const session = startSession("s1");

    await repo.create(session);

    expect(await repo.load("s1")).toEqual(session);
  });

  it("resumes the in-progress Session at its pending Turn", async () => {
    const repo = new InMemoryInterviewRepository();
    await repo.create(startSession("s1"));

    const resumed = await repo.load("s1");

    expect(resumed?.status).toBe("in_progress");
    expect(resumed?.turns[0].answer).toBeNull();
  });

  it("saves the advanced Session after an answer (per-Turn write)", async () => {
    const repo = new InMemoryInterviewRepository();
    await repo.create(startSession("s1"));

    const loaded = await repo.load("s1");
    await repo.save(recordAnswer(loaded!, "because I lead"));

    const after = await repo.load("s1");
    expect(after?.status).toBe("complete");
    expect(after?.turns[0].answer).toBe("because I lead");
    expect(after?.turnCount).toBe(1);
  });

  it("isolates stored state from the caller's reference", async () => {
    const repo = new InMemoryInterviewRepository();
    const session = startSession("s1");
    await repo.create(session);

    // Mutating the original after storing must not change the stored copy.
    session.turns[0].answer = "tampered";

    expect((await repo.load("s1"))?.turns[0].answer).toBeNull();
  });
});
