import { tribes } from "../tribes";

/**
 * A single adjective from the assessment word list and the tribe(s) it maps to.
 *
 * `tribes` holds one or more tribe slugs (see `tribes.ts`). A word mapped to a
 * single tribe is "owned" by that tribe; a word mapped to more than one is a
 * "shared" word and is scored at half weight to each (see `score.ts`).
 *
 * The data here is transcribed faithfully from the Word -> Tribe table in
 * `ASSESSMENT_DESIGN.md`, which is the source of truth for the scoring logic.
 */
export interface WordMapping {
  word: string;
  tribes: string[];
}

/** Selection constraints shown to and enforced on the participant (and observers). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The flat word list with each word's tribe mapping, in the order it appears in
 * `ASSESSMENT_DESIGN.md`. Participants never see the mappings — only the words.
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
// NB: ASSESSMENT_DESIGN.md's summary line reads "Total: 73 words", but both the
// flat list and the Word -> Tribe table it is transcribed from contain 74 rows
// (the summary line is an off-by-one). All 74 mappings are kept here verbatim.

/** The flat list of just the words, for presenting to participants (shuffled by the UI). */
export const wordList: string[] = words.map((w) => w.word);

/**
 * Assert that every tribe slug referenced by a word mapping exists in the
 * `tribes` source of truth, so the word data can never silently drift from it.
 * Throws on the first unknown slug. Pass arguments to validate alternative data
 * (used in tests).
 */
export function validateWordMappings(
  mappings: WordMapping[] = words,
  validSlugs: Set<string> = new Set(tribes.map((t) => t.slug)),
): void {
  for (const mapping of mappings) {
    if (mapping.tribes.length === 0) {
      throw new Error(`Word "${mapping.word}" maps to no tribe`);
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
