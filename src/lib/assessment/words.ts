import { tribes } from "../tribes";

/**
 * The flat word-selection list for the Tribe Index assessment, transcribed from
 * the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Participants see only the
 * words (in random order); the tribe mapping is backend scoring logic.
 *
 * Each word maps to one or more tribes by `slug`. A word shared across N tribes
 * splits a single point evenly — 1/N to each (see `scoring.ts`). For the common
 * two-tribe case this is the 0.5-each split described in the design doc; one
 * word ("Zealous") maps to three tribes and so contributes 1/3 to each.
 *
 * NOTE: `ASSESSMENT_DESIGN.md` heads the list "Total: 73 words", but the flat
 * list and the mapping table each enumerate the same 74 unique words. We
 * transcribe the enumerated data faithfully (74) and derive `WORD_COUNT` from
 * it rather than hard-coding the stale summary number.
 */
export interface AssessmentWord {
  readonly word: string;
  /** Tribe slugs this word maps to (1–3). */
  readonly tribes: readonly string[];
}

/** Minimum number of words a participant must select. */
export const MIN_WORDS = 8;
/** Maximum number of words a participant may select. */
export const MAX_WORDS = 15;

export const WORDS: readonly AssessmentWord[] = [
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

/** Number of words in the assessment list (derived from the data, not hard-coded). */
export const WORD_COUNT = WORDS.length;

/**
 * Assert the integrity of the word data against the `tribes` source of truth so
 * the mapping can never silently drift. Throws loudly if any word maps to no
 * tribe, references a slug that does not exist in `tribes`, or if a word appears
 * more than once. Pass an explicit list to validate arbitrary data (used in
 * tests); defaults to the live `WORDS`.
 */
export function validateWords(words: readonly AssessmentWord[] = WORDS): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const entry of words) {
    if (seen.has(entry.word)) {
      errors.push(`"${entry.word}" appears more than once`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      errors.push(`"${entry.word}" maps to no tribe`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        errors.push(`"${entry.word}" maps to unknown tribe slug "${slug}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid assessment word data:\n  ${errors.join("\n  ")}`);
  }
}

// Fail fast at module load: the live word data must always be valid.
validateWords();
