import { tribes } from "@/lib/tribes";

/**
 * The Self Assessment word data.
 *
 * Transcribed faithfully from the *Word List* and *Tribe Mapping* tables in
 * `ASSESSMENT_DESIGN.md` — the content source of truth. One flat, unlabeled list
 * of adjectives; the word→tribe mapping is the backend scoring logic and is never
 * shown to participants.
 *
 * Note on the count: the design doc's summary line reads "Total: 73 words", but
 * both its flat list and its mapping table enumerate **74** unique words (the two
 * sets are identical). We transcribe the doc's actual content (74) rather than
 * silently drop one; if a true 73 is later intended, remove the agreed word from
 * `wordTribeMap` and the list derives from it automatically.
 */

/** Selection constraint: a Subject (and Observer) must pick between 8 and 15 words. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * A word shared by more than one tribe contributes this weight to each of its
 * tribes (per the `ASSESSMENT_DESIGN.md` footnote: "Words marked with two tribes
 * score 0.5 points to each"). A word mapped to a single tribe contributes 1.
 */
export const SHARED_WORD_WEIGHT = 0.5;

/**
 * The word→tribe(slug) mapping. Each word maps to one or more tribe slugs from
 * `tribes.ts` (the source of truth). Shared words (2+ slugs) score
 * `SHARED_WORD_WEIGHT` to each; solo words score 1.
 */
export const wordTribeMap: Record<string, string[]> = {
  Aggressive: ["benjamin"],
  Alert: ["dan"],
  Analytical: ["issachar"],
  Authoritative: ["judah"],
  "Battle-tested": ["gad"],
  Bold: ["judah", "reuben"],
  Cautious: ["dan", "issachar"],
  Comforting: ["asher"],
  Consistent: ["joseph"],
  Convicted: ["simeon"],
  Courageous: ["judah"],
  Creative: ["naphtali"],
  Cunning: ["benjamin", "dan"],
  Decisive: ["simeon", "benjamin"],
  Dedicated: ["levi"],
  Deliberate: ["dan"],
  Devoted: ["levi"],
  Discerning: ["issachar", "dan"],
  Driven: ["benjamin", "reuben"],
  Enduring: ["gad", "joseph"],
  Energetic: ["reuben"],
  Enriching: ["asher"],
  Enterprising: ["zebulun"],
  Exacting: ["levi"],
  Expansive: ["zebulun"],
  Expressive: ["naphtali"],
  Faithful: ["joseph"],
  Fervent: ["simeon", "judah"],
  Fierce: ["benjamin"],
  "Free-spirited": ["naphtali"],
  Generous: ["zebulun", "asher"],
  Graceful: ["naphtali"],
  Gritty: ["gad"],
  Guarding: ["levi", "benjamin"],
  Healing: ["naphtali"],
  Honorable: ["judah"],
  Hospitable: ["asher"],
  Impulsive: ["reuben"],
  Insightful: ["issachar"],
  Inspiring: ["naphtali"],
  Intense: ["benjamin", "reuben"],
  Just: ["simeon"],
  Learned: ["issachar"],
  Loyal: ["joseph", "benjamin"],
  Measured: ["issachar"],
  Nurturing: ["asher"],
  Observant: ["dan", "issachar"],
  Organized: ["joseph"],
  Passionate: ["reuben", "simeon"],
  Patient: ["issachar"],
  Peaceful: ["asher"],
  Perceptive: ["issachar", "dan"],
  Precise: ["levi"],
  Prosperous: ["zebulun"],
  Protective: ["benjamin", "judah"],
  Reliable: ["joseph"],
  Resilient: ["joseph", "gad"],
  Resourceful: ["zebulun"],
  Reverent: ["levi"],
  Righteous: ["simeon"],
  Sacrificial: ["judah"],
  Skeptical: ["dan"],
  Steady: ["joseph", "gad"],
  Strategic: ["issachar", "dan"],
  Strong: ["reuben", "judah"],
  Supportive: ["joseph", "asher"],
  Territorial: ["benjamin", "gad"],
  Tough: ["gad"],
  Uncompromising: ["simeon"],
  Vigilant: ["dan"],
  Watchful: ["dan"],
  Welcoming: ["asher"],
  Wise: ["issachar"],
  Zealous: ["judah", "benjamin", "simeon"],
};

/** The flat, unlabeled word list participants see. Derived from the mapping so the two never drift. */
export const words: string[] = Object.keys(wordTribeMap);

/** The per-tribe weight a word contributes: 0.5 if shared across tribes, else 1. */
export function weightFor(slugs: string[]): number {
  return slugs.length > 1 ? SHARED_WORD_WEIGHT : 1;
}

/** Thrown by `validateWords` when the mapping references a tribe slug that does not exist. */
export class WordMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WordMappingValidationError";
  }
}

/**
 * Asserts that every tribe slug referenced by `wordTribeMap` resolves against the
 * `tribes` source of truth. Throws `WordMappingValidationError` naming every bad
 * `word → slug` pair, so the data can never silently drift from `tribes.ts`.
 */
export function validateWords(): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const bad: string[] = [];
  for (const [word, slugs] of Object.entries(wordTribeMap)) {
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        bad.push(`${word} → ${slug}`);
      }
    }
  }
  if (bad.length > 0) {
    throw new WordMappingValidationError(
      `Word mapping references unknown tribe slug(s): ${bad.join(", ")}`,
    );
  }
}
