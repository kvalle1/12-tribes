import { tribes } from "./tribes";

/**
 * Word data for the Tribe Index word-selection assessment.
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Each
 * word maps to one or more tribes (referenced by tribe `slug`). A word mapped
 * to a single tribe is a *solo* word; a word mapped to two or more tribes is a
 * *shared* word. Per the design doc, a shared word contributes 0.5 to each of
 * its tribes (the `*` convention in the coverage table); a solo word
 * contributes a full 1.0 to its tribe. Final tribe scores are normalized by
 * each tribe's available points (ADR-0001), so the 0.5/1.0 values here are the
 * per-word weights feeding the numerator — see `scoring.ts`.
 *
 * NOTE: `ASSESSMENT_DESIGN.md` prints "Total: 73 words", but the flat list and
 * the mapping table each contain 74 distinct, matching entries (the header is
 * an off-by-one, consistent with the per-tribe count mismatches PR #1 flagged).
 * We transcribe the authoritative mapping table faithfully — 74 entries — and
 * let `validateWordData` assert internal consistency rather than hard-code a
 * count.
 */

/** Minimum number of words a participant must select. */
export const SELECTION_MIN = 8;

/** Maximum number of words a participant may select. */
export const SELECTION_MAX = 15;

export interface WordEntry {
  /** The adjective shown to the participant. */
  word: string;
  /** The tribe slug(s) this word maps to. One = solo, two or more = shared. */
  tribes: string[];
}

/**
 * The flat 74-word adjective list and each word's tribe mapping, transcribed
 * faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 */
export const words: WordEntry[] = [
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

/** A word mapped to two or more tribes is shared (scores 0.5 to each). */
export function isShared(entry: WordEntry): boolean {
  return entry.tribes.length >= 2;
}

/**
 * Assert the word data is internally consistent and never silently drifts from
 * the `tribes` source of truth. Throws loudly on any problem.
 *
 * Accepts an optional `entries` argument so the failure paths are testable
 * without mutating the real `words` array; defaults to `words`.
 */
export function validateWordData(entries: WordEntry[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribe`);
    }
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate word in list: "${entry.word}"`);
    }
    seen.add(entry.word);

    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
