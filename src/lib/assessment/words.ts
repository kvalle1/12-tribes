import { tribes } from "@/lib/tribes";

/**
 * The flat, unlabeled adjective list participants choose from, and each word's
 * mapping to one or more tribes (referenced by tribe `slug`).
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`,
 * transcribed faithfully. Note two deliberate decisions where the design doc
 * is internally inconsistent or underspecified:
 *
 *  - The doc's summary says "Total: 73 words", but the flat list and the
 *    mapping table each contain 74 distinct words. We transcribe all 74 (the
 *    actual data), treating the "73" as a summary miscount.
 *  - The doc states a shared word "scores 0.5 points to each" tribe, which only
 *    covers two-tribe words. "Zealous" maps to THREE tribes. We generalize the
 *    rule so each word is worth one total point split equally among its tribes:
 *    weight per tribe = 1 / tribes.length (1/2 = 0.5 for two-tribe words, as the
 *    doc specifies; 1/3 for "Zealous"). See `weightPerTribe`.
 */
export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/** Soft selection range enforced by the assessment UI (not by scoring). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

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

/** The flat list of adjectives, in canonical order. */
export const wordList: string[] = words.map((w) => w.word);

/**
 * The points a single word contributes to each of its tribes. A word is worth
 * one total point, split equally among the tribes it maps to (1/n). For a
 * two-tribe word this is 0.5 each, exactly as `ASSESSMENT_DESIGN.md` specifies.
 */
export function weightPerTribe(mapping: WordMapping): number {
  return 1 / mapping.tribes.length;
}

/**
 * Asserts the word data is internally consistent and references only real
 * tribes. Throws (loudly) on any problem so the data can never silently drift
 * from the `tribes` source of truth.
 *
 * Accepts an optional list so the failure path is testable; defaults to the
 * module's own `words`.
 */
export function validateWords(list: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();

  for (const mapping of list) {
    if (seen.has(mapping.word)) {
      throw new Error(`Duplicate word in assessment list: "${mapping.word}"`);
    }
    seen.add(mapping.word);

    if (mapping.tribes.length === 0) {
      throw new Error(`Word "${mapping.word}" maps to no tribe`);
    }

    for (const slug of mapping.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${mapping.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
