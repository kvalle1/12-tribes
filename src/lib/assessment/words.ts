import { tribes, type Tribe } from "@/lib/tribes";

/**
 * The assessment word data: the flat list of adjectives a Subject (or Observer)
 * picks from, each mapped to one or more tribes by `slug`.
 *
 * Source of truth for the content: the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`. A word mapped to a single tribe contributes the full
 * per-word weight to it; a word shared across two or more tribes contributes
 * 0.5 to *each* mapped tribe (ADR-0001).
 *
 * This module is intentionally pure data + pure helpers so the scoring core
 * (`./score`) and the future assessment UI render from one source.
 *
 * NOTE ON COUNT: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md` enumerates
 * 74 distinct words, even though the doc's prose label reads "Total: 73 words".
 * That label is a stale count (PR #1 flagged the doc's word-count columns as
 * out of sync, pending a reconciliation pass). We transcribe the actual mapping
 * faithfully — all 74 entries — rather than arbitrarily drop one.
 */

export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more), referencing `tribes`. */
  tribes: string[];
}

/** Soft selection constraint — submission is gated to this inclusive range. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The 73-word flat list and its word→tribe(slug) mapping, transcribed verbatim
 * from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
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
 * The points a word contributes to *each* tribe it maps to. A word owned by a
 * single tribe is worth the full point; a shared word is worth 0.5 to each of
 * its tribes (ADR-0001).
 */
export function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? 0.5 : 1;
}

/**
 * Returns the `[word, slug]` pairs whose slug does not resolve against the
 * `tribes` source of truth. An empty array means the mapping is fully valid.
 * Parameterized for testability; defaults to the real data.
 */
export function findUnknownSlugs(
  wordList: WordMapping[] = words,
  tribeList: Tribe[] = tribes,
): Array<[string, string]> {
  const known = new Set(tribeList.map((t) => t.slug));
  const unknown: Array<[string, string]> = [];
  for (const mapping of wordList) {
    for (const slug of mapping.tribes) {
      if (!known.has(slug)) unknown.push([mapping.word, slug]);
    }
  }
  return unknown;
}

/**
 * Asserts every mapped slug resolves against `tribes`, throwing loudly if not,
 * so the word data can never silently drift from the tribe source of truth.
 */
export function validateWords(
  wordList: WordMapping[] = words,
  tribeList: Tribe[] = tribes,
): void {
  const unknown = findUnknownSlugs(wordList, tribeList);
  if (unknown.length > 0) {
    const detail = unknown.map(([word, slug]) => `${word} → "${slug}"`).join(", ");
    throw new Error(`Word mapping references unknown tribe slug(s): ${detail}`);
  }
}
