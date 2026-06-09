import { tribes } from "./tribes";

/**
 * Word data for the Tribe Index word-selection assessment.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 * Each word maps to one or more tribes (referenced by tribe `slug`). A word mapped
 * to more than one tribe is a "shared" word and contributes a fractional weight to
 * each of its tribes when scoring (see `scoring.ts` / ADR-0001).
 *
 * Note: the source doc's header says "Total: 73 words", but the flat list and the
 * mapping table both contain 74 entries and agree exactly — the header is a
 * miscount. We transcribe the 74-word mapping table, which is the authoritative data.
 */

export interface WordEntry {
  /** The adjective shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/** Minimum number of words a participant must select. */
export const MIN_WORDS = 8;
/** Maximum number of words a participant may select. */
export const MAX_WORDS = 15;

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

/**
 * Validates word data against the `tribes` source of truth.
 *
 * Throws if any word references a tribe slug that does not exist, or if the data
 * is otherwise malformed (empty word, no tribes, duplicate word). Call this in a
 * test (or at startup) so the mapping can never silently drift from `tribes.ts`.
 *
 * Defaults to validating the module's own `words`; accepts an explicit list so
 * the validation behavior itself can be tested.
 */
export function validateWords(entries: WordEntry[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!entry.word.trim()) {
      throw new Error("Word data contains an empty word");
    }
    if (seen.has(entry.word)) {
      throw new Error(`Word data contains a duplicate word: "${entry.word}"`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribes`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
