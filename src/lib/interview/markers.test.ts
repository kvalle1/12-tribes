import { describe, expect, it } from "vitest";

import { tribes } from "@/lib/tribes";
import {
  EVEN_COVERAGE_TOLERANCE,
  MARKER_TYPES,
  MAX_WEIGHT,
  MIN_WEIGHT,
  MarkerCatalogValidationError,
  type Marker,
  markerCatalog,
  validateMarkerCatalog,
} from "@/lib/interview/markers";

/** Markers grouped by tribe slug, for coverage assertions. */
function countsBySlug(catalog: readonly Marker[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of catalog) {
    counts.set(m.tribeSlug, (counts.get(m.tribeSlug) ?? 0) + 1);
  }
  return counts;
}

describe("markerCatalog (the real, authored catalog)", () => {
  it("passes validation", () => {
    expect(() => validateMarkerCatalog()).not.toThrow();
  });

  it("references only real tribe slugs from tribes.ts", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const marker of markerCatalog) {
      expect(validSlugs.has(marker.tribeSlug)).toBe(true);
    }
  });

  it("covers every one of the 12 tribes", () => {
    const counts = countsBySlug(markerCatalog);
    expect(counts.size).toBe(12);
    for (const tribe of tribes) {
      expect(counts.get(tribe.slug) ?? 0).toBeGreaterThan(0);
    }
  });

  it("has even coverage across all tribes (within tolerance)", () => {
    const values = [...countsBySlug(markerCatalog).values()];
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread).toBeLessThanOrEqual(EVEN_COVERAGE_TOLERANCE);
  });

  it("includes all four marker types for every tribe", () => {
    for (const tribe of tribes) {
      const types = new Set(
        markerCatalog
          .filter((m) => m.tribeSlug === tribe.slug)
          .map((m) => m.type),
      );
      for (const type of MARKER_TYPES) {
        expect(types.has(type), `${tribe.slug} missing ${type}`).toBe(true);
      }
    }
  });

  it("uses unique marker ids", () => {
    const ids = markerCatalog.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every weight within bounds", () => {
    for (const marker of markerCatalog) {
      expect(marker.weight).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(marker.weight).toBeLessThanOrEqual(MAX_WEIGHT);
    }
  });
});

describe("validateMarkerCatalog", () => {
  it("throws when a marker references a slug not in tribes.ts", () => {
    const bad: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, tribeSlug: "nonexistent-tribe" } : m,
    );
    expect(() => validateMarkerCatalog(bad)).toThrow(
      MarkerCatalogValidationError,
    );
    expect(() => validateMarkerCatalog(bad)).toThrow(/unknown tribe slug/i);
  });

  it("throws when coverage is uneven beyond the tolerance", () => {
    // Drop two simeon markers (keeping all four types) so it falls to 4 while
    // every other tribe stays at 6 — a spread of 2, beyond the tolerance of 1.
    const bad = markerCatalog.filter(
      (m) => m.id !== "simeon-strength-2" && m.id !== "simeon-fallLine-2",
    );
    expect(() => validateMarkerCatalog(bad)).toThrow(
      MarkerCatalogValidationError,
    );
    expect(() => validateMarkerCatalog(bad)).toThrow(/uneven marker coverage/i);
  });

  it("accepts coverage that is uneven but still within tolerance", () => {
    // Removing a single marker (without losing a type) leaves a spread of 1,
    // which equals the tolerance and must pass.
    const stillValid = markerCatalog.filter((m) => m.id !== "simeon-strength-2");
    expect(() => validateMarkerCatalog(stillValid)).not.toThrow();
  });

  it("throws on duplicate marker ids", () => {
    const bad: Marker[] = [...markerCatalog, { ...markerCatalog[0] }];
    expect(() => validateMarkerCatalog(bad)).toThrow(/duplicate marker ids/i);
  });

  it("throws when a tribe is missing a marker type", () => {
    const bad = markerCatalog.filter((m) => m.id !== "simeon-oil-1");
    expect(() => validateMarkerCatalog(bad)).toThrow(/missing marker type/i);
  });

  it("throws when a weight is out of bounds", () => {
    const bad: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, weight: MAX_WEIGHT + 5 } : m,
    );
    expect(() => validateMarkerCatalog(bad)).toThrow(/weight/i);
  });
});
