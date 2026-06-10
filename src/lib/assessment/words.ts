import { getTribeBySlug } from "@/lib/tribes";

/**
 * A single adjective from the assessment word list, mapped to the tribe(s) it
 * scores toward (referenced by tribe `slug`).
 *
 * Most words map to a single tribe; some are "shared" across two tribes, and
 * one ("Zealous") is shared across three. A shared word's single point is split
 * evenly across its mapped tribes — see `scoring.ts` for how the weight is
 * applied.
 */
export interface WordMapping {
  /** The adjective exactly as presented to participants. */
  readonly word: string;
  /** Tribe slugs this word scores toward (1–3 entries). */
  readonly tribes: readonly string[];
}

/**
 * Number of words a participant must select. Min/max are the selection
 * constants from `ASSESSMENT_DESIGN.md`; they bound the UI flow and are not
 * enforced by the pure scoring functions.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The flat assessment word list and each word's tribe mapping, transcribed from
 * the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * NOTE: the doc's prose header says "Total: 73 words", but the table (and the
 * flat list above it) actually contain 74 distinct words — the "73" is a stale
 * count in the source doc. This module transcribes the table faithfully, so the
 * authoritative length is `words.length` (74). The header should be corrected
 * in the doc.
 */
export const words: readonly WordMapping[] = [
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
 * Validate the word data against the `tribes` source of truth, failing loudly
 * so the data can never silently drift.
 *
 * Asserts that every word maps to at least one tribe, that there are no
 * duplicate words, and — the key guard — that every referenced tribe slug
 * resolves to a real tribe. Throws an `Error` describing the first problem
 * found.
 *
 * Accepts an explicit list for testability; defaults to the real `words`.
 */
export function validateWordData(list: readonly WordMapping[] = words): void {
  const seen = new Set<string>();
  for (const entry of list) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" is not mapped to any tribe`);
    }
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate word in list: "${entry.word}"`);
    }
    seen.add(entry.word);
    for (const slug of entry.tribes) {
      if (!getTribeBySlug(slug)) {
        throw new Error(
          `Word "${entry.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
