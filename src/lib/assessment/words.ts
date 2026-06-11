import { getTribeBySlug } from "../tribes";

/**
 * The Self Assessment word data — transcribed faithfully from the "Tribe
 * Mapping" table in `ASSESSMENT_DESIGN.md`, the content source of truth.
 *
 * Participants see one flat, unlabelled list (the `word`s); the tribe
 * mapping is the backend scoring logic and is never shown.
 *
 * Note on count: `ASSESSMENT_DESIGN.md` labels the list "73 words", but the
 * actual mapping table (and the participant list above it) both contain 74
 * entries — the "73" is an off-by-one in the doc's summary line. We transcribe
 * every row that is actually present and derive the count from the data
 * (`WORDS.length`) rather than hard-coding it, so the data can never silently
 * disagree with a magic number.
 *
 * Note on shared words: a word mapped to more than one tribe splits its single
 * point evenly across them (see `score.ts`). For the two-tribe words this is
 * the 0.5/0.5 split called out in the design doc; one word ("Zealous") maps to
 * three tribes and therefore contributes 1/3 to each — the natural
 * generalisation of the same rule.
 */
export interface WordMapping {
  /** The adjective shown to participants. */
  word: string;
  /** The tribe slug(s) this word maps to (1, 2, or 3 of them). */
  tribes: string[];
}

export const WORD_MAPPINGS: WordMapping[] = [
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

/** The flat list of adjectives shown to participants (presentation order). */
export const WORDS: string[] = WORD_MAPPINGS.map((m) => m.word);

/**
 * Selection constraint (ADR-0004 / PRD): a participant must pick within this
 * range for the result to be statistically meaningful. The same range applies
 * to 360 Observers so self and observer scores are comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * Assert the word data is internally consistent and references only real
 * tribes. Fails loudly (throws) so a transcription mistake can never ship
 * silently. Accepts an explicit mappings argument so it can be exercised with
 * deliberately-bad data in tests.
 */
export function validateWordMappings(mappings: WordMapping[] = WORD_MAPPINGS): void {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const { word, tribes } of mappings) {
    if (seen.has(word)) {
      errors.push(`Duplicate word: "${word}"`);
    }
    seen.add(word);

    if (tribes.length === 0) {
      errors.push(`Word "${word}" maps to no tribe`);
    }
    for (const slug of tribes) {
      if (!getTribeBySlug(slug)) {
        errors.push(`Word "${word}" references unknown tribe slug "${slug}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid word mappings:\n- ${errors.join("\n- ")}`);
  }
}
