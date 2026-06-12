import { tribes } from "../tribes";

/**
 * Word data for the Tribe Index assessment.
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 * Each word maps to one or more tribes (by slug). A word mapped to a single
 * tribe is worth a full point to that tribe; a *shared* word (two or more
 * tribes) is worth 0.5 to each of its tribes (ADR-0001, the per-word weight
 * that feeds the normalized score's numerator). "Zealous" is the only word
 * mapped to three tribes and follows the same shared-word rule: 0.5 to each.
 *
 * The word→tribe mappings are never shown to participants — they see one flat,
 * unlabeled, shuffled list (`wordList`).
 */

/** Minimum number of words a respondent must select to submit. */
export const MIN_WORDS = 8;
/** Maximum number of words a respondent may select. */
export const MAX_WORDS = 15;

export interface WordMapping {
  /** The adjective shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/**
 * The full word list with its tribe mapping, transcribed verbatim from the
 * mapping table in `ASSESSMENT_DESIGN.md`. The table (and the flat list above
 * it) contain 74 rows; the doc's "Total: 73 words" summary is an off-by-one
 * miscount, so we follow the actual table rather than the annotation.
 */
export const words: WordMapping[] = [
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

/** The flat list of adjectives shown to participants (no tribe labels). */
export const wordList: string[] = words.map((w) => w.word);

/**
 * The per-word weight contributed to *each* tribe the word maps to: a full
 * point for a solo word, 0.5 for a shared word (ADR-0001).
 */
export function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Asserts every mapped slug resolves against the `tribes` source of truth, and
 * that no word maps to zero tribes, so the word data can never silently drift
 * from the tribe model. Throws loudly on the first problem found.
 *
 * Defaults to validating the real `words` data; accepts an explicit argument so
 * the failure path is testable.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const { word, tribes: slugs } of mappings) {
    if (slugs.length === 0) {
      throw new Error(`Word "${word}" maps to no tribe`);
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
