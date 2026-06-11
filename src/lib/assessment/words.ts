import { tribes } from "@/lib/tribes";

/**
 * Assessment word data — the single source of truth for the Self / 360
 * word-selection instrument.
 *
 * The flat 73-word adjective list and each word's mapping to one or more
 * tribes (by `slug`) are transcribed faithfully from the "Tribe Mapping" table
 * in `ASSESSMENT_DESIGN.md`. Participants only ever see the bare word; the
 * tribe mapping is backend scoring logic and is never surfaced.
 */

/** Soft selection range — submission is gated to this many words (inclusive). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * Per-word scoring weight contributed to EACH tribe a word maps to.
 *
 * Per `ASSESSMENT_DESIGN.md`: a sole-mapped word scores 1 point to its tribe,
 * and a shared word "scores 0.5 to each mapped tribe". The one word mapped to
 * three tribes (`Zealous`) follows the same rule — 0.5 to each.
 */
export const SOLE_WORD_WEIGHT = 1;
export const SHARED_WORD_WEIGHT = 0.5;

export interface AssessmentWord {
  /** The adjective shown to the participant. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

export const words: AssessmentWord[] = [
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
 * The scoring weight a single word contributes to EACH of its mapped tribes.
 * Shared words (mapped to more than one tribe) are worth half a point each.
 */
export function wordWeight(w: AssessmentWord): number {
  return w.tribes.length > 1 ? SHARED_WORD_WEIGHT : SOLE_WORD_WEIGHT;
}

/**
 * Return any tribe slugs referenced by the word data that do not exist in the
 * `tribes` source of truth. An empty array means the data is fully resolved.
 */
export function findUnknownTribeSlugs(list: AssessmentWord[] = words): string[] {
  const valid = new Set(tribes.map((t) => t.slug));
  const unknown = new Set<string>();
  for (const w of list) {
    for (const slug of w.tribes) {
      if (!valid.has(slug)) unknown.add(slug);
    }
  }
  return [...unknown];
}

/**
 * Fail loudly if the word data references any tribe slug that does not resolve
 * against `tribes`, so the mapping can never silently drift from the source of
 * truth. Throws an Error listing the offending slugs.
 */
export function validateWordData(list: AssessmentWord[] = words): void {
  const unknown = findUnknownTribeSlugs(list);
  if (unknown.length > 0) {
    throw new Error(
      `Assessment word data references unknown tribe slug(s): ${unknown.join(", ")}`,
    );
  }
}
