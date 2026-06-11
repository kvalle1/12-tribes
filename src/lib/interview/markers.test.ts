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
  validateMarkerCatalog,
} from "@/lib/interview/markers";

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

  it("throws on an out-of-bounds weight", () => {
    const broken: Marker[] = markerCatalog.map((m, i) =>
      i === 0 ? { ...m, weight: 99 } : m,
    );
    expect(() => validateMarkerCatalog(broken)).toThrow(/weight/i);
  });

  it("respects an explicit coverage tolerance", () => {
    const broken = markerCatalog.slice(1); // spread of 1
    expect(() => validateMarkerCatalog(broken, undefined, 1)).not.toThrow();
  });
});
