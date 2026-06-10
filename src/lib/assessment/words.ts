import { tribes } from "@/lib/tribes";

/**
 * Assessment word data — the flat adjective list the Subject selects from,
 * each word mapped to one or more tribes (by slug). This is the backend
 * scoring source; participants only ever see the bare words.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`, which is the complete, internally-consistent
 * word→tribe source of truth.
 *
 * Source-doc notes (deliberate, documented deviations from the prose):
 *   - The doc's "Total: 73 words" header is an off-by-one: the mapping
 *     table (and the flat list) actually contain 74 distinct words. We
 *     transcribe all 74 rather than the stale count, and derive the count
 *     from the data so it can never drift.
 *   - The "Word Coverage by Tribe" count column is inconsistent with its
 *     own word lists (e.g. it says Dan has 10 but lists 11); the mapping
 *     table is authoritative, so we follow it.
 *   - Most shared words map to two tribes; "Zealous" maps to three
 *     (Judah · Benjamin · Simeon). Per the coverage-table semantics
 *     ("* = shared word, scores 0.5 to each mapped tribe"), any word
 *     mapped to more than one tribe contributes 0.5 to each (see `score.ts`).
 */
export interface AssessmentWord {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

export const words: AssessmentWord[] = [
  { word: "Aggressive", tribes: ["benjamin"] },
  { word: "Alert", tribes: ["dan"] },
  { word: "Analytical", tribes: ["issachar"] },
  { word: "Authoritative", tribes: ["judah"] },
  { word: "Battle-tested", tribes: ["gad"] },
  { word: "Bold", tribes: ["judah", "reuben"] },
  { word: "Cautious", tribes: ["dan", "issachar"] },
  { word: "Comforting", tribes: ["asher"] },
  { word: "Consistent", tribes: ["joseph"] },
  { word: "Convicted", tribes: ["simeon"] },
  { word: "Courageous", tribes: ["judah"] },
  { word: "Creative", tribes: ["naphtali"] },
  { word: "Cunning", tribes: ["benjamin", "dan"] },
  { word: "Decisive", tribes: ["simeon", "benjamin"] },
  { word: "Dedicated", tribes: ["levi"] },
  { word: "Deliberate", tribes: ["dan"] },
  { word: "Devoted", tribes: ["levi"] },
  { word: "Discerning", tribes: ["issachar", "dan"] },
  { word: "Driven", tribes: ["benjamin", "reuben"] },
  { word: "Enduring", tribes: ["gad", "joseph"] },
  { word: "Energetic", tribes: ["reuben"] },
  { word: "Enriching", tribes: ["asher"] },
  { word: "Enterprising", tribes: ["zebulun"] },
  { word: "Exacting", tribes: ["levi"] },
  { word: "Expansive", tribes: ["zebulun"] },
  { word: "Expressive", tribes: ["naphtali"] },
  { word: "Faithful", tribes: ["joseph"] },
  { word: "Fervent", tribes: ["simeon", "judah"] },
  { word: "Fierce", tribes: ["benjamin"] },
  { word: "Free-spirited", tribes: ["naphtali"] },
  { word: "Generous", tribes: ["zebulun", "asher"] },
  { word: "Graceful", tribes: ["naphtali"] },
  { word: "Gritty", tribes: ["gad"] },
  { word: "Guarding", tribes: ["levi", "benjamin"] },
  { word: "Healing", tribes: ["naphtali"] },
  { word: "Honorable", tribes: ["judah"] },
  { word: "Hospitable", tribes: ["asher"] },
  { word: "Impulsive", tribes: ["reuben"] },
  { word: "Insightful", tribes: ["issachar"] },
  { word: "Inspiring", tribes: ["naphtali"] },
  { word: "Intense", tribes: ["benjamin", "reuben"] },
  { word: "Just", tribes: ["simeon"] },
  { word: "Learned", tribes: ["issachar"] },
  { word: "Loyal", tribes: ["joseph", "benjamin"] },
  { word: "Measured", tribes: ["issachar"] },
  { word: "Nurturing", tribes: ["asher"] },
  { word: "Observant", tribes: ["dan", "issachar"] },
  { word: "Organized", tribes: ["joseph"] },
  { word: "Passionate", tribes: ["reuben", "simeon"] },
  { word: "Patient", tribes: ["issachar"] },
  { word: "Peaceful", tribes: ["asher"] },
  { word: "Perceptive", tribes: ["issachar", "dan"] },
  { word: "Precise", tribes: ["levi"] },
  { word: "Prosperous", tribes: ["zebulun"] },
  { word: "Protective", tribes: ["benjamin", "judah"] },
  { word: "Reliable", tribes: ["joseph"] },
  { word: "Resilient", tribes: ["joseph", "gad"] },
  { word: "Resourceful", tribes: ["zebulun"] },
  { word: "Reverent", tribes: ["levi"] },
  { word: "Righteous", tribes: ["simeon"] },
  { word: "Sacrificial", tribes: ["judah"] },
  { word: "Skeptical", tribes: ["dan"] },
  { word: "Steady", tribes: ["joseph", "gad"] },
  { word: "Strategic", tribes: ["issachar", "dan"] },
  { word: "Strong", tribes: ["reuben", "judah"] },
  { word: "Supportive", tribes: ["joseph", "asher"] },
  { word: "Territorial", tribes: ["benjamin", "gad"] },
  { word: "Tough", tribes: ["gad"] },
  { word: "Uncompromising", tribes: ["simeon"] },
  { word: "Vigilant", tribes: ["dan"] },
  { word: "Watchful", tribes: ["dan"] },
  { word: "Welcoming", tribes: ["asher"] },
  { word: "Wise", tribes: ["issachar"] },
  { word: "Zealous", tribes: ["judah", "benjamin", "simeon"] },
];

/**
 * Selection constraint (ADR / PRD): the Subject must pick within this soft
 * range for a statistically meaningful result. The same bounds apply to
 * Observers so self and observer scores are comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/** True when a selection count is within the allowed range (inclusive). */
export function isSelectionInRange(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}

/**
 * Assert that every tribe slug referenced by the word data resolves against
 * the `tribes` source of truth, so the mapping can never silently drift.
 * Throws loudly (listing the offending word/slug) if any reference is bad.
 *
 * Accepts the list to check so the failure path is testable; defaults to the
 * real `words` data.
 */
export function validateWordMappings(list: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const errors: string[] = [];

  for (const { word, tribes: slugs } of list) {
    if (slugs.length === 0) {
      errors.push(`"${word}" maps to no tribe`);
      continue;
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        errors.push(`"${word}" references unknown tribe slug "${slug}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid assessment word mappings:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}
