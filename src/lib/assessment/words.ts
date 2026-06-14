import { getTribeBySlug } from "@/lib/tribes";

/**
 * Word data for the Tribe Index assessment.
 *
 * This is the backend scoring data — the flat, unlabeled word list a Subject
 * sees, plus each word's mapping to one or more tribes (referenced by tribe
 * `slug`). It is transcribed faithfully from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`, which is the content source of truth.
 *
 * A word mapped to two or more tribes is a *shared* word: it contributes
 * {@link SHARED_WORD_WEIGHT} (0.5) to each of its tribes. A word mapped to a
 * single tribe contributes {@link SOLO_WORD_WEIGHT} (1). See ADR-0001 for the
 * normalized scoring model that consumes these weights.
 */

/** Selection constraint: the Subject must pick at least this many words. */
export const MIN_WORDS = 8;
/** Selection constraint: the Subject may pick at most this many words. */
export const MAX_WORDS = 15;

/** Per-tribe weight contributed by a word mapped to a single tribe. */
export const SOLO_WORD_WEIGHT = 1;
/** Per-tribe weight contributed by a word mapped to two or more tribes. */
export const SHARED_WORD_WEIGHT = 0.5;

export interface WordMapping {
  /** The adjective shown to the participant. */
  word: string;
  /** The tribe slug(s) this word maps to. */
  tribes: string[];
}

/**
 * The assessment words and their tribe mappings, in the order they appear in
 * `ASSESSMENT_DESIGN.md`. The UI shuffles this list per session; the order here
 * carries no meaning.
 *
 * NOTE: the source doc labels this "Total: 73 words", but its flat list and its
 * mapping table each enumerate 74 unique words (verified identical). We
 * transcribe the doc's actual content faithfully (74 words); the "73" is a
 * miscount in the source to be reconciled by the maintainer.
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
 * The per-tribe weight a word contributes: {@link SHARED_WORD_WEIGHT} when the
 * word is shared across two or more tribes, otherwise {@link SOLO_WORD_WEIGHT}.
 */
export function perTribeWeight(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? SHARED_WORD_WEIGHT : SOLO_WORD_WEIGHT;
}

/**
 * Assert that every tribe slug referenced by the given mappings resolves
 * against the `tribes` source of truth. Throws loudly with the offending
 * `word → slug` pairs so the data can never silently drift.
 */
export function validateWordMappings(mappings: WordMapping[]): void {
  const invalid: string[] = [];
  for (const mapping of mappings) {
    for (const slug of mapping.tribes) {
      if (!getTribeBySlug(slug)) {
        invalid.push(`${mapping.word} → ${slug}`);
      }
    }
  }
  if (invalid.length > 0) {
    throw new Error(
      `Word mapping references unknown tribe slug(s): ${invalid.join(", ")}`,
    );
  }
}

/** Validate the real {@link words} data against the `tribes` source of truth. */
export function validateWords(): void {
  validateWordMappings(words);
}
