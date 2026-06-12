import { tribes } from "@/lib/tribes";

/**
 * Word-selection data for the Self / 360 assessment.
 *
 * This is a faithful transcription of the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md` — the content source of truth. Participants see only
 * the flat `word` list (shuffled, unlabeled); the `tribes` mapping is the
 * backend scoring logic and is never shown.
 *
 * A word mapped to a single tribe scores a full point to it; a word mapped to
 * more than one tribe is a *shared* word and scores 0.5 to each mapped tribe
 * (per the design doc: "scores 0.5 to each mapped tribe"). The per-word weight
 * lives in `score.ts`; this module only owns the data + its validation.
 */

/** Selection constraints (soft range; submission is gated to this window). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export interface WordMapping {
  /** The adjective shown to the participant, exactly as in the design doc. */
  word: string;
  /** Tribe slugs this word maps to (one or more), referencing `tribes`. */
  tribes: string[];
}

/**
 * The 74-word list and each word's tribe mapping, transcribed verbatim from the
 * "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Note: the design doc's prose says "73 words", but its own mapping table lists
 * 74 rows — transcribed faithfully here. `Zealous` maps to three tribes; like
 * every multi-tribe word it scores 0.5 to each.
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

/**
 * Asserts the word data can never silently drift from the `tribes` source of
 * truth. Throws loudly if a word maps to no tribe, or to a slug that does not
 * resolve against `tribes`. Defaults to validating the real `words` list but
 * accepts an explicit list so the failure mode is unit-testable.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const { word, tribes: slugs } of mappings) {
    if (slugs.length === 0) {
      throw new Error(`Word "${word}" maps to no tribe.`);
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${word}" maps to unknown tribe slug "${slug}" (not in tribes).`,
        );
      }
    }
  }
}
