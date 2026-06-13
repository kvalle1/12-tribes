import { getTribeBySlug } from "../tribes";

/**
 * The flat, unlabeled word list and its word -> tribe(slug) mapping, transcribed
 * faithfully from the "Tribe Mapping" table in ASSESSMENT_DESIGN.md — which the
 * doc labels "the backend scoring logic", i.e. the source of truth for scoring.
 * Participants only ever see {@link wordList}; the tribe mapping is never
 * surfaced to them.
 *
 * NOTE — source-doc discrepancy: ASSESSMENT_DESIGN.md is internally
 * inconsistent about its size. The "Tribe Mapping" table and the "Word Coverage
 * by Tribe" table both list **74** words including "Aggressive" (-> Benjamin),
 * but the prose flat list and its "Total: 73 words" header omit "Aggressive".
 * We follow the two scoring-relevant tables (74 words, Aggressive included),
 * since this module's job is to mirror the scoring mapping. The design doc's
 * flat list and total should be reconciled to 74.
 */
export interface WordMapping {
  /** The adjective exactly as it appears in the word list. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/** A word selected by the Subject must fall within this soft range to submit. */
export const SELECTION_MIN = 8;
export const SELECTION_MAX = 15;

/**
 * A word mapped to more than one tribe is a "shared" word and contributes this
 * weight to each of its tribes (ADR-0001 / ASSESSMENT_DESIGN.md footnote:
 * "scores 0.5 to each mapped tribe"). A word mapped to a single tribe
 * contributes a full point.
 */
export const SHARED_WORD_WEIGHT = 0.5;
export const SOLE_WORD_WEIGHT = 1;

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

/** The per-tribe weight a word contributes: 0.5 if shared, 1 if sole. */
export function weightFor(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? SHARED_WORD_WEIGHT : SOLE_WORD_WEIGHT;
}

/**
 * Asserts every tribe slug referenced by the word mappings resolves against the
 * `tribes` source of truth, so the data can never silently drift. Throws,
 * loudly, listing every offending word -> slug pair. Accepts a list so the
 * invariant can be exercised against bad data in tests.
 */
export function validateWordMappings(list: WordMapping[] = words): void {
  const invalid: string[] = [];
  for (const mapping of list) {
    if (mapping.tribes.length === 0) {
      invalid.push(`${mapping.word} -> (no tribes)`);
      continue;
    }
    for (const slug of mapping.tribes) {
      if (!getTribeBySlug(slug)) {
        invalid.push(`${mapping.word} -> ${slug}`);
      }
    }
  }
  if (invalid.length > 0) {
    throw new Error(
      `Word mapping references unknown tribe slug(s): ${invalid.join(", ")}`,
    );
  }
}
