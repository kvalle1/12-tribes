import { describe, expect, it } from "vitest";
import { coerceScoringOutput } from "./agent";

/**
 * Unit tests for the pure validation of the scoring agent's tool-use payload —
 * the boundary that turns an untrusted structured response into `MarkerDelta`s.
 * The live Claude call is not exercised here; the Scoring engine still re-checks
 * every surviving delta against the catalog.
 */
describe("coerceScoringOutput", () => {
  it("keeps well-formed deltas and the next question", () => {
    const out = coerceScoringOutput({
      deltas: [
        { markerId: "judah-strength-front", tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "aware" },
      ],
      nextQuestion: "  Tell me about a time you had to decide quickly.  ",
    });
    expect(out.deltas).toEqual([
      { markerId: "judah-strength-front", tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "aware" },
    ]);
    expect(out.nextQuestion).toBe("Tell me about a time you had to decide quickly.");
  });

  it("drops malformed delta entries", () => {
    const out = coerceScoringOutput({
      deltas: [
        { markerId: "levi-oil-access", tribeSlug: "levi", type: "oil", delta: 2, postureSignal: "integrated" }, // valid
        { tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "aware" }, // no markerId
        { markerId: "x", tribeSlug: "judah", type: "bogus", delta: 1, postureSignal: "aware" }, // bad type
        { markerId: "x", tribeSlug: "judah", type: "strength", delta: "lots", postureSignal: "aware" }, // non-numeric
        { markerId: "x", tribeSlug: "judah", type: "strength", delta: 1, postureSignal: "thriving" }, // bad posture
        "not an object",
      ],
      nextQuestion: "next",
    });
    expect(out.deltas).toHaveLength(1);
    expect(out.deltas[0].markerId).toBe("levi-oil-access");
  });

  it("tolerates a missing deltas array and a missing next question", () => {
    const out = coerceScoringOutput({});
    expect(out.deltas).toEqual([]);
    expect(out.nextQuestion).toBe("");
  });

  it("does not throw on non-object input", () => {
    expect(coerceScoringOutput(null).deltas).toEqual([]);
    expect(coerceScoringOutput("garbage").deltas).toEqual([]);
  });
});
