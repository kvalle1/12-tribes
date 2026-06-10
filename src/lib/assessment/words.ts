import { tribes } from "../tribes";

/**
 * Word-selection data for the Tribe Index assessment.
 *
 * This is the backend scoring data — never surfaced to participants. The flat
 * 73-word list and each word's tribe mapping are transcribed faithfully from
 * the table in `ASSESSMENT_DESIGN.md`. A word mapped to more than one tribe is
 * a *shared* word and contributes 0.5 to each mapped tribe (ADR-0001); a word
 * mapped to a single tribe contributes 1.0.
 *
 * Tribes are referenced by `slug` so this data stays bound to the `tribes`
 * source of truth in `tribes.ts`. `validateWordData()` asserts that binding so
 * the mapping can never silently drift.
 */

/** Inclusive lower bound on how many words a participant must select. */
export const MIN_WORDS = 8;
/** Inclusive upper bound on how many words a participant may select. */
export const MAX_WORDS = 15;

export interface WordMapping {
  /** The adjective shown in the flat list. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/**
 * The 73-word list and word→tribe(slug) mapping, faithful to the table in
 * `ASSESSMENT_DESIGN.md`. Order here is irrelevant to scoring; the UI shuffles
 * per session.
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
  { word: "Zealous", tribes: ["judah", "benjamin", "simeon"] },
];

/** Expected size of the flat word list (per `ASSESSMENT_DESIGN.md`). */
export const WORD_COUNT = 73;

/**
 * Assert the word data is internally consistent and bound to the `tribes`
 * source of truth. Throws (fails loudly) on any drift so the data can never
 * silently diverge from the tribes it scores against.
 *
 * Defaults to the real word list; accepts an explicit list for testing.
 */
export function validateWordData(list: WordMapping[] = words): void {
  if (list === words && list.length !== WORD_COUNT) {
    throw new Error(
      `Word list has ${list.length} words, expected ${WORD_COUNT}.`,
    );
  }

  const seen = new Set<string>();
  const validSlugs = new Set(tribes.map((t) => t.slug));

  for (const { word, tribes: mappedSlugs } of list) {
    if (seen.has(word)) {
      throw new Error(`Duplicate word in word list: "${word}".`);
    }
    seen.add(word);

    if (mappedSlugs.length === 0) {
      throw new Error(`Word "${word}" maps to no tribe.`);
    }

    for (const slug of mappedSlugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${word}" maps to unknown tribe slug "${slug}".`,
        );
      }
    }
  }
}
