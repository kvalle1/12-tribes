import { tribes } from "@/lib/tribes";

/**
 * Soft selection range for the assessment (ADR-0001 / PRD): a Subject — and
 * later an Observer — must pick at least {@link MIN_WORDS} and at most
 * {@link MAX_WORDS} words for a result to be statistically meaningful. The
 * range is enforced at submission time; the pure scoring core does not depend
 * on it.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export interface WordMapping {
  /** The adjective shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one, or more for a shared word). */
  tribes: string[];
}

/**
 * The flat adjective list and its word→tribe(slug) mapping, transcribed from
 * the "Tribe Mapping" table in ASSESSMENT_DESIGN.md. Participants only ever see
 * the word; the tribe column is backend scoring logic.
 *
 * A shared word (mapped to more than one tribe) contributes an equal split of a
 * single point to each — 0.5 each for a two-tribe word (ADR-0001), 1/3 each for
 * the lone three-tribe word ("Zealous"). The split lives in the scoring module.
 *
 * Note: ASSESSMENT_DESIGN.md captions this list "73 words", but the mapping
 * table — the stated source of truth — enumerates 74. The table is transcribed
 * verbatim here.
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
 * truth: every mapped slug must resolve to a real tribe, every word must map to
 * at least one tribe, and no word may appear twice. Throws loudly on the first
 * violation. Defaults to validating the live {@link words} list; accepts an
 * explicit list so the invariant itself can be tested against bad input.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();
  for (const { word, tribes: slugs } of mappings) {
    if (seen.has(word)) {
      throw new Error(`Duplicate word "${word}" in the assessment word list`);
    }
    seen.add(word);
    if (slugs.length === 0) {
      throw new Error(`Word "${word}" maps to no tribe`);
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
