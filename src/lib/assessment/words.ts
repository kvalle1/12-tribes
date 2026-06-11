import { getTribeBySlug } from "@/lib/tribes";

/**
 * The Self Assessment word data — the single source of truth for the flat
 * adjective list and each word's mapping to one or more tribes (by slug).
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Two notes on faithfulness to that source:
 *  - The document's prose says "Total: 73 words", but the flat list and the
 *    mapping table each actually enumerate 74 (and agree with each other). We
 *    transcribe the 74 words that are actually present; "73" is a stale count
 *    in the doc, not 74 entries with one to drop.
 *  - "Zealous" maps to three tribes (Judah · Benjamin · Simeon). The doc only
 *    states the weight rule for two-tribe words ("0.5 to each"). We generalize
 *    that stated design as `weight = 1 / mappedTribeCount`, which yields exactly
 *    0.5 for every two-tribe (Shared) word — matching the spec — and 1/3 each
 *    for the lone three-tribe word. The split lives in `score.ts`.
 */

/** Minimum number of words a respondent must select for a valid submission. */
export const MIN_WORDS = 8;
/** Maximum number of words a respondent may select for a valid submission. */
export const MAX_WORDS = 15;

export interface WordMapping {
  /** Display form shown to the respondent, e.g. "Battle-tested". */
  word: string;
  /** Tribe slugs this word maps to (1–3). Shared words map to two. */
  tribes: string[];
}

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
 * Assert that every tribe slug referenced by a word mapping resolves against the
 * `tribes` source of truth, so the data can never silently drift. Throws loudly,
 * listing every offending `word→slug` pair, when a slug does not exist.
 *
 * Accepts the mappings to check so the invariant itself is unit-testable; defaults
 * to the real `words` list.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const unknown: string[] = [];
  for (const mapping of mappings) {
    if (mapping.tribes.length === 0) {
      unknown.push(`${mapping.word}→(no tribes)`);
      continue;
    }
    for (const slug of mapping.tribes) {
      if (!getTribeBySlug(slug)) {
        unknown.push(`${mapping.word}→${slug}`);
      }
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `Unknown tribe slug(s) in word mappings: ${unknown.join(", ")}`,
    );
  }
}
