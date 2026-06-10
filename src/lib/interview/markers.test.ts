// `markers.ts` imports `server-only`, which throws outside an RSC bundle.
// Stub it to a no-op so the pure data/validators can be unit-tested.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import {
  MARKER_TYPES,
  MARKERS_PER_TRIBE,
  MAX_WEIGHT,
  MIN_WEIGHT,
  type Marker,
  markerCatalog,
  getMarkersForTribe,
  validateEvenCoverage,
  validateMarkerCatalog,
  validateMarkerSlugs,
  validateTypeCoverage,
} from "./markers";

const judahSlug = "judah";

function withoutFirst(slug: string, type?: Marker["type"]): Marker[] {
  const idx = markerCatalog.findIndex(
    (m) => m.tribeSlug === slug && (type ? m.type === type : true),
  );
  return markerCatalog.filter((_, i) => i !== idx);
}

describe("markerCatalog (the authored data)", () => {
  it("passes the full catalog validation as authored", () => {
    expect(() => validateMarkerCatalog()).not.toThrow();
  });

  it("covers all 12 tribes from tribes.ts", () => {
    const slugs = new Set(markerCatalog.map((m) => m.tribeSlug));
    expect(slugs.size).toBe(tribes.length);
    expect(tribes.every((t) => slugs.has(t.slug))).toBe(true);
  });

  it("has even coverage — MARKERS_PER_TRIBE markers for every tribe", () => {
    for (const t of tribes) {
      expect(getMarkersForTribe(t.slug)).toHaveLength(MARKERS_PER_TRIBE);
    }
    expect(markerCatalog).toHaveLength(tribes.length * MARKERS_PER_TRIBE);
  });

  it("covers all four marker types for every tribe", () => {
    for (const t of tribes) {
      const types = new Set(getMarkersForTribe(t.slug).map((m) => m.type));
      for (const type of MARKER_TYPES) {
        expect(types.has(type)).toBe(true);
      }
    }
  });

  it("has unique, slug-prefixed marker ids", () => {
    const ids = markerCatalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(markerCatalog.every((m) => m.id.startsWith(`${m.tribeSlug}-`))).toBe(true);
  });

  it("has a non-empty signal and an in-bounds weight on every marker", () => {
    for (const m of markerCatalog) {
      expect(m.signal.trim().length).toBeGreaterThan(0);
      expect(m.weight).toBeGreaterThan(MIN_WEIGHT);
      expect(m.weight).toBeLessThanOrEqual(MAX_WEIGHT);
    }
  });
});

describe("validateMarkerSlugs", () => {
  it("accepts the real catalog", () => {
    expect(() => validateMarkerSlugs(markerCatalog)).not.toThrow();
  });

  it("throws when a marker references an unknown tribe slug", () => {
    const bad: Marker[] = [
      ...markerCatalog,
      { id: "ghost-strength-x", tribeSlug: "not-a-tribe", type: "strength", signal: "x", weight: 1 },
    ];
    expect(() => validateMarkerSlugs(bad)).toThrow(/not-a-tribe/);
  });
});

describe("validateEvenCoverage", () => {
  it("accepts the real catalog (default tolerance 0)", () => {
    expect(() => validateEvenCoverage(markerCatalog)).not.toThrow();
  });

  it("throws when one tribe has fewer markers than the rest", () => {
    expect(() => validateEvenCoverage(withoutFirst(judahSlug))).toThrow();
  });

  it("throws when a tribe is missing from the catalog entirely", () => {
    const bad = markerCatalog.filter((m) => m.tribeSlug !== judahSlug);
    expect(() => validateEvenCoverage(bad)).toThrow();
  });

  it("respects an explicit tolerance", () => {
    // Dropping one marker makes the spread 1; tolerance 1 should allow it.
    expect(() => validateEvenCoverage(withoutFirst(judahSlug), 1)).not.toThrow();
  });
});

describe("validateTypeCoverage", () => {
  it("accepts the real catalog", () => {
    expect(() => validateTypeCoverage(markerCatalog)).not.toThrow();
  });

  it("throws when a tribe is missing one of the four marker types", () => {
    const bad = markerCatalog.filter(
      (m) => !(m.tribeSlug === judahSlug && m.type === "oil"),
    );
    expect(() => validateTypeCoverage(bad)).toThrow(/oil/);
  });
});
