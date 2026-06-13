import { tribes } from "@/lib/tribes";

/**
 * Word data for the Self Assessment.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`
 * (the content source of truth). Each Word maps to one or more Tribes by `slug`.
 *
 * Notes on the source table:
 * - It lists 74 distinct words (the "Total: 73 words" header in the doc is an
 *   off-by-one miscount; the word list and the mapping table both enumerate 74).
 * - Most shared words map to two tribes; "Zealous" maps to three
 *   (Judah · Benjamin · Simeon). The doc's footnote — "scores 0.5 to each mapped
 *   tribe" — is applied as written: a word contributes 0.5 to *each* tribe it is
 *   shared across, and 1.0 when it belongs to a single tribe. See `wordWeight`.
 */
export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one for a solo word, two or three for a shared word). */
  tribes: string[];
}

/** Inclusive minimum number of words a respondent must select to submit. */
export const MIN_WORDS = 8;
/** Inclusive maximum number of words a respondent may select. */
export const MAX_WORDS = 15;

export const wordMappings: WordMapping[] = [
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

/** The flat list of words as shown to participants (unlabeled, order-independent). */
export const words: string[] = wordMappings.map((m) => m.word);

/**
 * Weight a word contributes to *each* of its mapped tribes:
 * 1.0 for a solo word, 0.5 for a shared word (regardless of how many tribes it
 * is shared across).
 */
export function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Assert every tribe slug referenced by the word mappings resolves against the
 * `tribes` source of truth. Throws (loudly) on the first unknown slug so the
 * data can never silently drift from `tribes.ts`. Defaults to the real data;
 * accepts an explicit list so the failure path is testable.
 */
export function validateWordMappings(mappings: WordMapping[] = wordMappings): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const mapping of mappings) {
    if (mapping.tribes.length === 0) {
      throw new Error(`Word "${mapping.word}" maps to no tribes`);
    }
    for (const slug of mapping.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${mapping.word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
