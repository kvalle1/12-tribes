import { tribes } from "../tribes";

/**
 * The flat, unlabeled word list and its word→tribe(slug) mapping, transcribed
 * faithfully from the "Tribe Mapping" table in ASSESSMENT_DESIGN.md (the
 * content source of truth). Participants only ever see {@link wordList}; the
 * tribe mapping is backend scoring logic and is never shown.
 *
 * Note: ASSESSMENT_DESIGN.md labels this list "Total: 73 words", but both its
 * prose list and its mapping table actually contain 74 distinct words — the
 * label is an off-by-one in the doc. We transcribe the full mapping faithfully.
 *
 * A word mapped to more than one tribe is a "shared" word: its weight is split
 * evenly across the tribes it points to (1 / n). For the common two-tribe case
 * that is 0.5 each (ADR-0001); the single three-tribe word, "Zealous", splits
 * to 1/3 each by the same rule.
 */
export interface AssessmentWord {
  /** The adjective as shown to participants. */
  word: string;
  /** The tribe slug(s) this word maps to. One or more. */
  tribes: string[];
}

/** Soft selection range — submission is gated to this many words (inclusive). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export const assessmentWords: AssessmentWord[] = [
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

/** The adjectives participants choose from, in their canonical (unshuffled) order. */
export const wordList: string[] = assessmentWords.map((w) => w.word);

/**
 * Assert that every tribe slug referenced by the word mapping resolves against
 * the `tribes` source of truth, so the data can never silently drift. Throws
 * loudly listing any offending word/slug pairs. Defaults to the live mapping;
 * accepts an explicit list for testing.
 */
export function validateWordMappings(words: AssessmentWord[] = assessmentWords): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const errors: string[] = [];

  for (const { word, tribes: slugs } of words) {
    if (slugs.length === 0) {
      errors.push(`"${word}" maps to no tribe`);
      continue;
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        errors.push(`"${word}" references unknown tribe slug "${slug}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid word→tribe mapping:\n${errors.join("\n")}`);
  }
}
