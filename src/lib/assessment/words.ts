import { tribes } from "@/lib/tribes";

/**
 * A single selectable adjective and the tribe(s) it maps to.
 *
 * `tribes` holds tribe **slugs** (matching `tribes.ts`). A word mapped to one
 * tribe is a solo word; a word mapped to two (or, for the lone case of
 * "Zealous", three) is a *shared* word. The per-tribe scoring weight of a
 * shared word is 0.5 (see `wordWeight` in `score.ts` and ADR-0001).
 */
export interface WordEntry {
  word: string;
  tribes: string[];
}

/**
 * Selection constraint (ADR / PRD): a respondent must pick within this range
 * for the result to be statistically meaningful. The same bounds apply to
 * Observers so self and observer scores are comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The flat word list and each word's tribe mapping, transcribed faithfully
 * from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Order here matches
 * the design table; the UI shuffles per session, so this order carries no
 * meaning beyond traceability back to the source.
 *
 * NOTE: the design doc's headline says "73 words", but both its flat Word List
 * and its Tribe Mapping table enumerate the same 74 distinct words — the "73"
 * is an off-by-one miscount in the doc, not a word to drop here.
 */
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
 * Pure check used by `validateWords`: returns a human-readable error for every
 * word→tribe edge whose slug is not in `validSlugs`. Empty array means valid.
 * Kept pure (takes its inputs) so it can be tested against deliberately-bad
 * data without mutating the real list.
 */
export function findUnknownTribeSlugs(
  entries: WordEntry[],
  validSlugs: Set<string>,
): string[] {
  const errors: string[] = [];
  for (const entry of entries) {
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        errors.push(`Word "${entry.word}" maps to unknown tribe slug "${slug}"`);
      }
    }
  }
  return errors;
}

/**
 * Asserts that every tribe slug referenced by the word list resolves against
 * the `tribes` source of truth, so the mapping can never silently drift.
 * Throws loudly with all offending edges if not.
 */
export function validateWords(): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const errors = findUnknownTribeSlugs(words, validSlugs);
  if (errors.length > 0) {
    throw new Error(
      `Invalid word→tribe mapping(s) in words.ts:\n${errors.join("\n")}`,
    );
  }
}
