import { describe, expect, it } from "vitest";
import {
  buildScoringSystem,
  SCORE_TOOL,
  validateScorePayload,
} from "./agent";
import { getMarkerById } from "./markers";

describe("validateScorePayload", () => {
  it("accepts a delta citing a catalogued Marker and clamps to its weight", () => {
    // judah-fall-power is a fallLine Marker with weight 3.
    const deltas = validateScorePayload({
      deltas: [{ markerId: "judah-fall-power", delta: 2, postureSignal: "integrated" }],
    });
    expect(deltas).toEqual([
      {
        markerId: "judah-fall-power",
        tribeSlug: "judah",
        type: "fallLine",
        delta: 2,
        postureSignal: "integrated",
      },
    ]);
  });

  it("takes tribeSlug and type from the catalog, not from the model's claim (ADR-0003)", () => {
    const [delta] = validateScorePayload({
      deltas: [
        { markerId: "judah-fall-power", tribeSlug: "levi", type: "strength", delta: 1 },
      ],
    });
    const marker = getMarkerById("judah-fall-power")!;
    expect(delta.tribeSlug).toBe(marker.tribeSlug);
    expect(delta.type).toBe(marker.type);
  });

  it("drops a delta citing an unknown Marker id", () => {
    const deltas = validateScorePayload({
      deltas: [
        { markerId: "not-a-real-marker", delta: 2 },
        { markerId: "judah-strength-front", delta: 1 },
      ],
    });
    expect(deltas.map((d) => d.markerId)).toEqual(["judah-strength-front"]);
  });

  it("clamps a delta above the Marker's weight down to the weight", () => {
    // judah-strength-front has weight 1.
    const [delta] = validateScorePayload({
      deltas: [{ markerId: "judah-strength-front", delta: 9 }],
    });
    expect(delta.delta).toBe(1);
  });

  it("clamps a negative delta to zero", () => {
    const [delta] = validateScorePayload({
      deltas: [{ markerId: "judah-strength-front", delta: -4 }],
    });
    expect(delta.delta).toBe(0);
  });

  it("defaults a missing or invalid postureSignal to neutral", () => {
    const [missing] = validateScorePayload({
      deltas: [{ markerId: "judah-strength-front", delta: 1 }],
    });
    const [invalid] = validateScorePayload({
      deltas: [{ markerId: "judah-strength-front", delta: 1, postureSignal: "banana" }],
    });
    expect(missing.postureSignal).toBe("neutral");
    expect(invalid.postureSignal).toBe("neutral");
  });

  it("coerces a non-numeric delta to zero rather than throwing", () => {
    const [delta] = validateScorePayload({
      deltas: [{ markerId: "judah-strength-front", delta: "lots" }],
    });
    expect(delta.delta).toBe(0);
  });

  it("collapses repeated citations of one Marker, capping its total at the weight", () => {
    // judah-strength-front has weight 1; two citations must not sum to 2.
    const deltas = validateScorePayload({
      deltas: [
        { markerId: "judah-strength-front", delta: 1 },
        { markerId: "judah-strength-front", delta: 1 },
      ],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0].delta).toBe(1);
  });

  it("accumulates repeated citations up to the weight ceiling", () => {
    // judah-fall-power has weight 3; 2 + 2 accumulates but caps at 3.
    const [delta] = validateScorePayload({
      deltas: [
        { markerId: "judah-fall-power", delta: 2 },
        { markerId: "judah-fall-power", delta: 2 },
      ],
    });
    expect(delta.delta).toBe(3);
  });

  it("returns an empty array for malformed payloads", () => {
    expect(validateScorePayload(null)).toEqual([]);
    expect(validateScorePayload({})).toEqual([]);
    expect(validateScorePayload({ deltas: "nope" })).toEqual([]);
    expect(validateScorePayload({ deltas: [42, null, "x"] })).toEqual([]);
  });
});

describe("SCORE_TOOL", () => {
  it("is a strict tool so the structured scoring payload validates (no free-form rationale)", () => {
    expect(SCORE_TOOL.strict).toBe(true);
    expect(SCORE_TOOL.input_schema.properties).toHaveProperty("deltas");
  });
});

describe("buildScoringSystem", () => {
  it("sends the Marker Catalog and tribe profiles as the static scoring context", () => {
    const text = buildScoringSystem()
      .map((b) => b.text)
      .join("\n");
    expect(text).toContain("judah-fall-power"); // a Marker id
    expect(text).toContain("judah"); // a tribe slug
  });

  it("caches the static context so it is not re-billed every Turn (ADR-0009)", () => {
    const blocks = buildScoringSystem();
    // Exactly one breakpoint, on the last static block, so the whole prefix caches.
    const cached = blocks.filter((b) => b.cache_control);
    expect(cached).toHaveLength(1);
    expect(blocks[blocks.length - 1].cache_control).toEqual({ type: "ephemeral" });
  });
});
