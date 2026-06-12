import { getTribeBySlug } from "../tribes";

/**
 * The Self Assessment word data — the single source of truth for the flat,
 * unlabeled adjective list and each word's mapping to one or more tribes.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 * Tribes are referenced by `slug` so the data is validated against `tribes.ts`
 * (the tribe source of truth) and can never silently drift — see
 * {@link validateWordData}.
 *
 * Scoring weight (ADR-0001): a word mapped to a single tribe contributes a full
 * point to it; a *shared* word (mapped to more than one tribe) contributes 0.5
 * to each mapped tribe, per the design-doc footnote. This holds for the one
 * three-tribe word ("Zealous") as well — 0.5 to each of its tribes.
 */
export interface WordEntry {
  /** The adjective as shown to participants (display casing). */
  word: string;
  /** Tribe slugs this word maps to (1 or more). */
  tribes: string[];
}

/** Soft selection range: participants must pick between 8 and 15 words. */
export const SELECTION_MIN = 8;
export const SELECTION_MAX = 15;

export const words: WordEntry[] = [
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
 * The scoring weight a single entry contributes to *each* of its mapped tribes.
 * Exclusive word → 1; shared word (2+ tribes) → 0.5 to each (ADR-0001).
 */
export function weightFor(entry: WordEntry): number {
  return entry.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Asserts that every tribe slug referenced by the word data resolves against
 * the `tribes` source of truth, and that there are no duplicate words. Throws
 * loudly (listing every offending reference) so bad data fails fast rather than
 * silently mis-scoring.
 */
export function validateWordEntries(entries: WordEntry[]): void {
  const problems: string[] = [];

  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.word.toLowerCase();
    if (seen.has(key)) problems.push(`Duplicate word: "${entry.word}"`);
    seen.add(key);

    if (entry.tribes.length === 0) {
      problems.push(`"${entry.word}" maps to no tribe`);
    }
    for (const slug of entry.tribes) {
      if (!getTribeBySlug(slug)) {
        problems.push(`"${entry.word}" → unknown tribe slug "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid assessment word data:\n  ${problems.join("\n  ")}`);
  }
}

/** Validates the real {@link words} list against `tribes.ts`. */
export function validateWordData(): void {
  validateWordEntries(words);
}

// Fail loudly at import time if the data ever drifts from the tribe source of
// truth — this can never silently ship a broken mapping.
validateWordData();
