import { describe, expect, it } from "vitest";

import { getMarkerById } from "./markers";
import { parseScoringPayload } from "./agent";

/**
 * The network call in `scoreAnswer` is exercised by running the app (it needs a
 * live key). What we unit-test is `parseScoringPayload` — the seam that enforces
 * the scoring contract on whatever the model emits: Marker-constrained, bounded,
 * and with slug/type taken from the catalog rather than the model.
 */
describe("parseScoringPayload", () => {
  it("keeps a well-formed delta and takes slug/type from the catalog", () => {
    const { deltas } = parseScoringPayload({
      deltas: [
        {
          markerId: "judah-strength-front",
          tribeSlug: "wrong-slug", // model lies; catalog wins
          type: "shadow", // model lies; catalog wins
          delta: 1,
          postureSignal: "active-shadow",
        },
      ],
      nextQuestion: "Tell me about a decision you had to own.",
    });
    const marker = getMarkerById("judah-strength-front")!;
    expect(deltas).toEqual([
      {
        markerId: "judah-strength-front",
        tribeSlug: marker.tribeSlug,
        type: marker.type,
        delta: 1,
        postureSignal: "active-shadow",
      },
    ]);
  });

  it("drops a delta that cites an unknown Marker id (marker-constrained)", () => {
    const { deltas } = parseScoringPayload({
      deltas: [{ markerId: "totally-made-up", tribeSlug: "judah", type: "strength", delta: 3 }],
      nextQuestion: "",
    });
    expect(deltas).toHaveLength(0);
  });

  it("clamps the magnitude to the Marker's weight and floors negatives at 0", () => {
    const marker = getMarkerById("levi-fall-gatekeep")!; // fallLine, weight 3
    const { deltas } = parseScoringPayload({
      deltas: [
        { markerId: "levi-fall-gatekeep", delta: 999 },
        { markerId: "levi-strength-guard", delta: -5 },
      ],
      nextQuestion: null,
    });
    const gate = deltas.find((d) => d.markerId === "levi-fall-gatekeep")!;
    const guard = deltas.find((d) => d.markerId === "levi-strength-guard")!;
    expect(gate.delta).toBe(marker.weight);
    expect(guard.delta).toBe(0);
  });

  it("defaults an absent delta to the Marker's weight", () => {
    const marker = getMarkerById("dan-oil-trust")!;
    const { deltas } = parseScoringPayload({
      deltas: [{ markerId: "dan-oil-trust" }],
      nextQuestion: "x",
    });
    expect(deltas[0].delta).toBe(marker.weight);
  });

  it("falls back to a neutral posture signal for a missing or invalid value", () => {
    const { deltas } = parseScoringPayload({
      deltas: [
        { markerId: "dan-oil-trust", delta: 1, postureSignal: "sideways" },
        { markerId: "dan-strength-sentinel", delta: 1 },
      ],
      nextQuestion: "x",
    });
    expect(deltas[0].postureSignal).toBe("neutral");
    expect(deltas[1].postureSignal).toBe("neutral");
  });

  it("normalizes an empty or whitespace nextQuestion to null", () => {
    expect(parseScoringPayload({ deltas: [], nextQuestion: "   " }).nextQuestion).toBeNull();
    expect(parseScoringPayload({ deltas: [] }).nextQuestion).toBeNull();
  });

  it("is defensive against malformed payloads (missing/!array/null)", () => {
    expect(parseScoringPayload(null)).toEqual({ deltas: [], nextQuestion: null });
    expect(parseScoringPayload({ deltas: "nope" })).toEqual({ deltas: [], nextQuestion: null });
    expect(parseScoringPayload({ deltas: [42, null, "x"] }).deltas).toHaveLength(0);
  });
});
