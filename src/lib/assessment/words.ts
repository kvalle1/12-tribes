import { tribes } from "../tribes";

/**
 * One adjective from the assessment's flat word list, mapped to the tribe(s)
 * it scores toward. A word mapped to more than one tribe is a "shared" word:
 * its single point is split equally among its tribes (see `scoring.ts`).
 */
export interface AssessmentWord {
  /** The adjective shown to participants. */
  word: string;
  /** The tribe slug(s) this word scores toward (referenced by `Tribe.slug`). */
  tribes: string[];
}

/** Fewest words a participant may select. */
export const MIN_SELECTED_WORDS = 8;
/** Most words a participant may select. */
export const MAX_SELECTED_WORDS = 15;

/**
 * The assessment word list and its tribe mapping, transcribed faithfully from
 * the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * The table contains 74 rows; the doc's "Total: 73 words" line is an
 * off-by-one tally error (the flat list and the mapping table list the same
 * 74 words). "Zealous" is the one word mapped to three tribes; every other
 * shared word maps to two.
 */
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
 * Assert that every word maps to at least one tribe and that every referenced
 * slug resolves against the `tribes` source of truth, so the word data can
 * never silently drift away from the tribe definitions. Throws on the first
 * problem it finds.
 *
 * @param wordList - the data to validate; defaults to the real word list.
 */
export function assertWordDataValid(wordList: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const entry of wordList) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribe.`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" maps to unknown tribe slug "${slug}".`,
        );
      }
    }
  }
}

// Validate eagerly on import so a bad edit fails loudly at startup rather than
// silently producing wrong scores.
assertWordDataValid();
