import { tribes } from "../tribes";

/**
 * Assessment word data — the single source of truth for the word-selection
 * instrument's scoring inputs.
 *
 * The flat list of adjectives and their word→tribe mapping are transcribed
 * faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Tribes
 * are referenced by `slug` (matching `tribes.ts`) rather than display name so
 * the data is validated against the source of truth and can never silently
 * drift — see {@link validateWords}.
 *
 * A word mapped to more than one tribe is a Shared word and contributes half
 * weight (0.5) to each of its tribes rather than full weight (1.0) to one
 * (`ASSESSMENT_DESIGN.md` legend: "* = shared word, scores 0.5 to each mapped
 * tribe"). The per-tribe normalization that turns these weights into a 0–1
 * Tribe score lives in `./score` (ADR-0001).
 *
 * Note: `ASSESSMENT_DESIGN.md` heads the list "Total: 73 words", but its
 * mapping table actually enumerates 74 distinct words (no duplicates). The
 * table is the authoritative scoring source, so all 74 are transcribed here.
 */

/** A selectable adjective and the tribe(s) it maps to (by slug). */
export interface AssessmentWord {
  /** The adjective exactly as presented to the participant. */
  word: string;
  /** Tribe slugs this word maps to; length > 1 means a Shared word. */
  tribes: string[];
}

/**
 * Soft selection range. A participant must select at least {@link MIN_WORDS}
 * and at most {@link MAX_WORDS} words for a result to be meaningful; the same
 * constraint applies to Observers so self and observer scores are comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/** The 74-word flat list with its word→tribe(slug) mapping. */
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

/** A word→tribe reference whose slug does not resolve against `tribes`. */
export interface UnknownTribeReference {
  word: string;
  slug: string;
}

/**
 * Return every word→tribe reference whose slug does not exist in the `tribes`
 * source of truth. An empty array means the data is consistent.
 *
 * Pure and parameterized so the guard itself is testable: pass a deliberately
 * broken word list to assert it is caught.
 */
export function findUnknownTribeSlugs(
  wordList: AssessmentWord[] = words,
  validSlugs: ReadonlySet<string> = new Set(tribes.map((t) => t.slug)),
): UnknownTribeReference[] {
  const unknown: UnknownTribeReference[] = [];
  for (const entry of wordList) {
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        unknown.push({ word: entry.word, slug });
      }
    }
  }
  return unknown;
}

/**
 * Assert that every word maps only to tribes that exist in `tribes`. Throws
 * loudly listing the offenders if any slug has drifted, so bad data can never
 * pass silently.
 */
export function validateWords(wordList: AssessmentWord[] = words): void {
  const unknown = findUnknownTribeSlugs(wordList);
  if (unknown.length > 0) {
    const details = unknown.map((u) => `"${u.word}" → "${u.slug}"`).join(", ");
    throw new Error(
      `Assessment word data references unknown tribe slug(s): ${details}`,
    );
  }
}
