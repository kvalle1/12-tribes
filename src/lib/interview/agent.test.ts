import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  SCORING_MODEL,
  SCORING_TOOL_NAME,
  buildScoringRequest,
  parseScoringMessage,
  scoreAnswer,
  type ScoringModelClient,
} from "./agent";

function toolUseMessage(deltas: unknown): Anthropic.Message {
  return {
    content: [
      { type: "tool_use", id: "tu_1", name: SCORING_TOOL_NAME, input: { deltas } },
    ],
  } as unknown as Anthropic.Message;
}

describe("buildScoringRequest", () => {
  const req = buildScoringRequest({
    question: "Tell me about a time you led.",
    answer: "I stepped up to run the project when nobody else would.",
  });

  it("targets the scoring model and asks for the scoring tool", () => {
    expect(req.model).toBe(SCORING_MODEL);
    expect(req.tools?.[0]?.name).toBe(SCORING_TOOL_NAME);
    // Opus 5.5 rejects forced tool_choice — must stay "auto".
    expect(req.tool_choice).toEqual({ type: "auto" });
  });

  it("marks the tool strict so arguments validate against the schema", () => {
    const tool = req.tools?.[0] as Anthropic.Tool;
    expect(tool.strict).toBe(true);
  });

  it("caches the static system prefix and leaves the answer uncached", () => {
    const system = req.system as Anthropic.TextBlockParam[];
    const last = system[system.length - 1];
    expect(last.cache_control).toEqual({ type: "ephemeral" });
    // The volatile answer rides in messages, after the cached prefix.
    const content = req.messages[0].content as string;
    expect(content).toContain("nobody else would");
    expect(JSON.stringify(req.system)).not.toContain("nobody else would");
  });
});

describe("parseScoringMessage", () => {
  it("extracts the deltas from the scoring tool call", () => {
    const raw = parseScoringMessage(
      toolUseMessage([{ markerId: "judah-strength-front", delta: 1 }]),
    );
    expect(raw).toEqual([{ markerId: "judah-strength-front", delta: 1 }]);
  });

  it("returns null when the model called no tool (an anomaly, not a zero score)", () => {
    const message = {
      content: [{ type: "text", text: "I think you're a leader." }],
      stop_reason: "end_turn",
    } as unknown as Anthropic.Message;
    expect(parseScoringMessage(message)).toBeNull();
  });

  it("returns an empty list when deltas is absent or not an array", () => {
    expect(parseScoringMessage(toolUseMessage(undefined))).toEqual([]);
    expect(parseScoringMessage(toolUseMessage("nope"))).toEqual([]);
  });
});

describe("scoreAnswer", () => {
  it("sends the built request and returns catalog-validated deltas", async () => {
    const create = vi.fn().mockResolvedValue(
      toolUseMessage([
        // Real Marker, over-weighted → clamped to the catalog weight (1).
        {
          markerId: "judah-strength-front",
          tribeSlug: "judah",
          type: "strength",
          delta: 5,
          postureSignal: "neutral",
        },
        // Hallucinated Marker → dropped.
        {
          markerId: "ghost-marker",
          tribeSlug: "judah",
          type: "strength",
          delta: 1,
          postureSignal: "neutral",
        },
      ]),
    );
    const client: ScoringModelClient = { messages: { create } };

    const input = { question: "Q", answer: "A" };
    const deltas = await scoreAnswer(input, { client });

    expect(create).toHaveBeenCalledWith(buildScoringRequest(input));
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      markerId: "judah-strength-front",
      tribeSlug: "judah",
      delta: 1,
    });
  });

  it("throws when the model does not call the scoring tool (fails loud)", async () => {
    const message = {
      content: [{ type: "text", text: "You're clearly a leader." }],
      stop_reason: "end_turn",
    } as unknown as Anthropic.Message;
    const client: ScoringModelClient = {
      messages: { create: vi.fn().mockResolvedValue(message) },
    };
    await expect(scoreAnswer({ question: "Q", answer: "A" }, { client })).rejects.toThrow(
      /did not call/,
    );
  });
});
