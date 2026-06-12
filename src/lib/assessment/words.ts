import { tribes } from "@/lib/tribes";

/**
 * Word data for the Tribe Index assessment.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`,
 * which is the content source of truth for scoring. Two notes about that source:
 *
 *  - Its summary line reads "Total: 73 words", but the flat word list and the
 *    mapping table both contain 74 entries (the "73" is an off-by-one in the
 *    doc). We transcribe all 74.
 *  - The doc says shared words "score 0.5 points to each" of "two tribes", while
 *    one word (Zealous) maps to three. The coverage-table legend generalizes the
 *    rule — "* = shared word, scores 0.5 to each mapped tribe" — so any word
 *    mapped to more than one tribe contributes 0.5 to each.
 *
 * Tribes are referenced by `slug`; `validateWordMappings()` asserts every slug
 * resolves against the `tribes` source of truth so the data can never silently
 * drift.
 */
export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** One or more tribe slugs this word maps to. */
  tribes: string[];
}

/** Minimum number of words a participant must select to submit. */
export const MIN_WORDS = 8;
/** Maximum number of words a participant may select. */
export const MAX_WORDS = 15;

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

/**
 * The per-tribe weight a word contributes: a solo word is worth a full 1.0,
 * a word shared across multiple tribes is worth 0.5 to each (ADR-0001).
 */
export function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Asserts every tribe slug referenced by the word mappings resolves against the
 * `tribes` source of truth. Throws loudly on the first unknown slug so authoring
 * mistakes surface immediately rather than scoring silently wrong.
 *
 * Accepts an optional list (defaults to the real `words`) so the invariant can
 * be exercised against deliberately-bad data in tests.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const slugs = new Set(tribes.map((t) => t.slug));
  for (const mapping of mappings) {
    for (const slug of mapping.tribes) {
      if (!slugs.has(slug)) {
        throw new Error(
          `Word "${mapping.word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
