import { tribes } from "../tribes";

/**
 * The word-selection word data: the flat adjective list and each word's mapping
 * to one or more tribes, transcribed from the table in `ASSESSMENT_DESIGN.md`.
 *
 * Participants see only `word`; the `tribes` mapping is backend scoring logic
 * and is never shown.
 *
 * Notes on faithful transcription of `ASSESSMENT_DESIGN.md`:
 * - The design doc's prose says "Total: 73 words", but both its flat list and
 *   its mapping table actually contain **74** distinct words. We transcribe the
 *   real content (74 words) rather than dropping one to match the stated count.
 * - The doc states shared words "score 0.5 points to each", a rule written for
 *   the two-tribe case. One word — "Zealous" — maps to three tribes. We
 *   generalize to an equal split: each word contributes a total weight of 1.0
 *   spread evenly across its mapped tribes (`weightPerTribe = 1 / tribes.length`),
 *   which yields exactly 0.5 for the documented two-tribe case and 1/3 for the
 *   three-tribe one. See `weightPerTribe` and ADR-0001.
 */
export interface Word {
  /** The adjective shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (1–3); references `tribes` in `tribes.ts`. */
  tribes: string[];
}

/** Minimum number of words a respondent must select for a valid submission. */
export const MIN_WORDS = 8;
/** Maximum number of words a respondent may select for a valid submission. */
export const MAX_WORDS = 15;

export const words: Word[] = [
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
 * The weight a single word contributes to *each* of its mapped tribes. The
 * word's total weight is always 1.0, split equally across its tribes: 1.0 for a
 * sole-tribe word, 0.5 for a two-tribe (shared) word, 1/3 for the three-tribe
 * word. This is the per-word weight that feeds the scoring numerator (ADR-0001).
 */
export function weightPerTribe(word: Word): number {
  return 1 / word.tribes.length;
}

/**
 * Returns the slugs referenced by the word list that do not exist in the
 * `tribes` source of truth. Empty array means the mapping is fully valid.
 */
export function findInvalidSlugs(list: Word[] = words): string[] {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const invalid = new Set<string>();
  for (const entry of list) {
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) invalid.add(slug);
    }
  }
  return [...invalid];
}

/**
 * Asserts every slug referenced by the word list resolves against `tribes`,
 * throwing loudly if any does not — so the word→tribe mapping can never
 * silently drift from the tribe source of truth.
 */
export function validateWordMappings(list: Word[] = words): void {
  const invalid = findInvalidSlugs(list);
  if (invalid.length > 0) {
    throw new Error(
      `Word mapping references unknown tribe slug(s): ${invalid.join(", ")}`,
    );
  }
}
