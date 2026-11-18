import { describe, expect, it } from "vitest";

import { tribes } from "@/lib/tribes";
import {
  MARKER_COUNT,
  MARKER_TYPES,
  MARKERS_PER_TRIBE,
  type Marker,
  MarkerCatalogError,
  getMarkerById,
  markerCatalog,
  markersForTribe,
  oilMarkerForTribe,
  routeMaturedFallLines,
  validateMarkerCatalog,
} from "@/lib/interview/markers";
import type { MarkerDelta } from "@/lib/interview/types";

const tribeSlugs = tribes.map((t) => t.slug);

describe("marker catalog shape", () => {
  it("is keyed to real tribe slugs and carries the full Marker shape", () => {
    expect(markerCatalog.length).toBeGreaterThan(0);
    expect(MARKER_COUNT).toBe(markerCatalog.length);

    for (const marker of markerCatalog) {
      expect(tribeSlugs).toContain(marker.tribeSlug);
      expect(MARKER_TYPES).toContain(marker.type);
      expect(marker.id).toBeTruthy();
      expect(marker.signal).toBeTruthy();
      expect(typeof marker.weight).toBe("number");
    }
  });

  it("has unique marker ids", () => {
    const ids = markerCatalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all four marker types", () => {
    const present = new Set(markerCatalog.map((m) => m.type));
    expect([...present].sort()).toEqual([...MARKER_TYPES].sort());
  });

  it("looks markers up by id and by tribe", () => {
    const first = markerCatalog[0];
    expect(getMarkerById(first.id)).toBe(first);
    expect(getMarkerById("no-such-marker")).toBeUndefined();
    expect(markersForTribe(first.tribeSlug)).toContain(first);
  });
});

describe("even coverage across all 12 tribes", () => {
  it("gives every tribe the same number of markers", () => {
    for (const slug of tribeSlugs) {
      expect(markersForTribe(slug).length).toBe(MARKERS_PER_TRIBE);
    }
  });

  it("leaves no tribe uncovered", () => {
    const covered = new Set(markerCatalog.map((m) => m.tribeSlug));
    expect(covered.size).toBe(tribes.length);
  });
});

describe("oilMarkerForTribe", () => {
  it("returns the single oil Marker for every tribe", () => {
    for (const slug of tribeSlugs) {
      const oil = oilMarkerForTribe(slug);
      expect(oil?.tribeSlug).toBe(slug);
      expect(oil?.type).toBe("oil");
    }
  });

  it("returns undefined for an unknown tribe", () => {
    expect(oilMarkerForTribe("not-a-tribe")).toBeUndefined();
  });
});

describe("routeMaturedFallLines", () => {
  const delta = (over: Partial<MarkerDelta>): MarkerDelta => ({
    markerId: "dan-fall-idolatry",
    tribeSlug: "dan",
    type: "fallLine",
    delta: 3,
    postureSignal: "integrated",
    ...over,
  });

  it("re-cites a matured fall-line to the tribe's oil Marker (ADR-0004)", () => {
    const oil = oilMarkerForTribe("dan")!;
    const [routed] = routeMaturedFallLines([delta({})]);
    expect(routed.markerId).toBe(oil.id);
    expect(routed.type).toBe("oil");
    expect(routed.tribeSlug).toBe("dan");
  });

  it("preserves the earned strength — never lowers it, even past the oil weight", () => {
    // dan-fall-idolatry weighs 3; dan's oil Marker weighs 2. Routing keeps 3.
    const [routed] = routeMaturedFallLines([delta({ delta: 3 })]);
    expect(routed.delta).toBe(3);
  });

  it("carries the integrated posture signal through to the routed delta", () => {
    const [routed] = routeMaturedFallLines([delta({})]);
    expect(routed.postureSignal).toBe("integrated");
  });

  it("also routes a matured shadow Marker to oil", () => {
    const [routed] = routeMaturedFallLines([
      delta({ markerId: "dan-shadow-cynicism", type: "shadow" }),
    ]);
    expect(routed.type).toBe("oil");
    expect(routed.markerId).toBe(oilMarkerForTribe("dan")!.id);
  });

  it("leaves an active-shadow fall-line untouched (it is not matured)", () => {
    const input = delta({ postureSignal: "active-shadow" });
    expect(routeMaturedFallLines([input])).toEqual([input]);
  });

  it("leaves a neutral fall-line untouched", () => {
    const input = delta({ postureSignal: "neutral" });
    expect(routeMaturedFallLines([input])).toEqual([input]);
  });

  it("leaves strength and oil Markers untouched regardless of posture", () => {
    const strength = delta({ markerId: "dan-strength-sentinel", type: "strength" });
    const oil = delta({ markerId: "dan-oil-trust", type: "oil" });
    expect(routeMaturedFallLines([strength, oil])).toEqual([strength, oil]);
  });

  it("is a pure projection — does not mutate its input", () => {
    const input = delta({});
    const snapshot = { ...input };
    routeMaturedFallLines([input]);
    expect(input).toEqual(snapshot);
  });
});

describe("validateMarkerCatalog", () => {
  it("accepts the real, authored catalog", () => {
    expect(() => validateMarkerCatalog(markerCatalog)).not.toThrow();
  });

  it("throws on a marker referencing an unknown tribe slug", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, tribeSlug: "atlantis" } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(MarkerCatalogError);
    expect(() => validateMarkerCatalog(broken)).toThrow(/unknown tribe slug/i);
  });

  it("throws when coverage is uneven (a tribe is short a marker)", () => {
    // Drop one marker: that tribe now has fewer than the rest. Slugs all stay
    // valid, so this isolates the even-coverage check.
    const broken = markerCatalog.slice(1);
    expect(() => validateMarkerCatalog(broken)).toThrow(MarkerCatalogError);
    expect(() => validateMarkerCatalog(broken)).toThrow(/uneven/i);
  });

  it("throws when a tribe has no markers at all", () => {
    const [firstTribe] = tribeSlugs;
    const broken = markerCatalog.filter((m) => m.tribeSlug !== firstTribe);
    expect(() => validateMarkerCatalog(broken)).toThrow(/uneven/i);
  });

  it("throws on a duplicate marker id", () => {
    const broken: Marker[] = [...markerCatalog, { ...markerCatalog[0] }];
    expect(() => validateMarkerCatalog(broken)).toThrow(/duplicate/i);
  });

  it("throws on an over-weight marker", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, weight: 99 } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(/weight/i);
  });

  it("throws on an under-weight (zero or negative) marker", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, weight: 0 } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(/weight/i);
  });

  it("throws on a marker with an empty signal", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, signal: "" } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(/signal/i);
  });

  it("throws on a marker with a whitespace-only signal", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, signal: "   " } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(/signal/i);
  });

  it("respects an explicit coverage tolerance", () => {
    const broken = markerCatalog.slice(1); // spread of 1
    expect(() => validateMarkerCatalog(broken, undefined, 1)).not.toThrow();
  });
});
