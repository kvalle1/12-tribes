import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { tribes } from "@/lib/tribes";
import {
  COVERAGE_TOLERANCE,
  MARKER_TYPES,
  MAX_WEIGHT,
  MIN_WEIGHT,
  type Marker,
  allMarkers,
  markerCatalog,
  validateMarkerCatalog,
} from "./markers";

const validSlugs = tribes.map((t) => t.slug);

function countByTribe(markers: Marker[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of markers) {
    counts.set(m.tribeSlug, (counts.get(m.tribeSlug) ?? 0) + 1);
  }
  return counts;
}

describe("Marker Catalog data", () => {
  it("passes its own validation against the real tribe slugs", () => {
    expect(() => validateMarkerCatalog(allMarkers, validSlugs)).not.toThrow();
  });

  it("is keyed by tribe slug and consistent with the flat list", () => {
    expect(Object.keys(markerCatalog).sort()).toEqual([...validSlugs].sort());
    const flatFromCatalog = Object.values(markerCatalog).flat();
    expect(flatFromCatalog).toHaveLength(allMarkers.length);
    for (const [slug, markers] of Object.entries(markerCatalog)) {
      for (const m of markers) {
        expect(m.tribeSlug).toBe(slug);
      }
    }
  });

  it("references only real tribe slugs from tribes.ts", () => {
    for (const m of allMarkers) {
      expect(validSlugs).toContain(m.tribeSlug);
    }
  });

  it("covers all four marker types", () => {
    const types = new Set(allMarkers.map((m) => m.type));
    expect([...types].sort()).toEqual([...MARKER_TYPES].sort());
  });

  it("gives every one of the 12 tribes all four marker types", () => {
    for (const slug of validSlugs) {
      const typesForTribe = new Set(
        allMarkers.filter((m) => m.tribeSlug === slug).map((m) => m.type),
      );
      expect([...typesForTribe].sort()).toEqual([...MARKER_TYPES].sort());
    }
  });

  it("has even coverage across all 12 tribes (within tolerance)", () => {
    const counts = countByTribe(allMarkers);
    expect(counts.size).toBe(12);
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(
      COVERAGE_TOLERANCE,
    );
  });

  it("uses unique, stable ids and bounded weights", () => {
    const ids = allMarkers.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of allMarkers) {
      expect(m.weight).toBeGreaterThanOrEqual(MIN_WEIGHT);
      expect(m.weight).toBeLessThanOrEqual(MAX_WEIGHT);
      expect(m.signal.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("validateMarkerCatalog", () => {
  const good: Marker = {
    id: "judah-strength-1",
    tribeSlug: "judah",
    type: "strength",
    signal: "Steps to the front and takes public responsibility.",
    weight: 2,
  };

  it("fails loudly on a marker whose slug is not a real tribe", () => {
    const bad: Marker = { ...good, id: "atlantis-strength-1", tribeSlug: "atlantis" };
    expect(() => validateMarkerCatalog([good, bad], validSlugs)).toThrow(/slug/i);
  });

  it("fails loudly when a tribe has no markers at all (incomplete coverage)", () => {
    // A single tribe's markers can never cover all 12 — coverage must be complete.
    expect(() => validateMarkerCatalog([good], validSlugs)).toThrow(/coverage|missing|cover/i);
  });

  it("fails loudly on uneven coverage", () => {
    // One marker for every tribe (even), then pile extras onto a single tribe.
    const evenBase: Marker[] = validSlugs.map((slug, i) => ({
      id: `${slug}-strength-1`,
      tribeSlug: slug,
      type: "strength",
      signal: `signal ${i}`,
      weight: 1,
    }));
    const lopsided: Marker[] = [
      ...evenBase,
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `judah-extra-${i}`,
        tribeSlug: "judah",
        type: "strength" as const,
        signal: `extra ${i}`,
        weight: 1,
      })),
    ];
    expect(() => validateMarkerCatalog(lopsided, validSlugs)).toThrow(/coverage|even/i);
  });

  it("fails loudly on a duplicate marker id", () => {
    const dup: Marker = { ...good };
    expect(() => validateMarkerCatalog([good, dup], validSlugs)).toThrow(/id/i);
  });

  it("fails loudly on an out-of-bounds weight", () => {
    const heavy: Marker = { ...good, id: "judah-strength-2", weight: MAX_WEIGHT + 1 };
    expect(() => validateMarkerCatalog([good, heavy], validSlugs)).toThrow(/weight/i);
  });

  it("fails loudly on an invalid marker type", () => {
    const wrong = { ...good, type: "vibe" } as unknown as Marker;
    expect(() => validateMarkerCatalog([good, wrong], validSlugs)).toThrow(/type/i);
  });
});

describe("server-only trust boundary", () => {
  it("marks the catalog module as server-only so it cannot be client-bundled", () => {
    const src = readFileSync(resolve(__dirname, "markers.ts"), "utf8");
    expect(src).toMatch(/^import ["']server-only["'];/m);
  });
});
