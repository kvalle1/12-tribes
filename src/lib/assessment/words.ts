import { tribes } from "@/lib/tribes";

/**
 * Selection constants — the soft range a participant (and, later, a 360
 * Observer) must land in before a selection can be scored. The same range
 * applies to both so self and observer scores stay comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * One adjective from the flat word list and the tribe `slug`(s) it maps to.
 *
 * A word mapped to a single tribe is a "solo" word and contributes a full
 * point to that tribe. A word mapped to two (or more) tribes is a "shared"
 * word and contributes half a point to each — see the weighting in
 * `./score`.
 */
export interface WordMapping {
  word: string;
  /** Tribe slugs (from `tribes.ts`) this word maps to. */
  tribes: string[];
}

/**
 * The word→tribe mapping, transcribed verbatim from the *Tribe Mapping*
 * table in `ASSESSMENT_DESIGN.md`. Each tribe name in that table is recorded
 * here as the corresponding `slug` from `tribes.ts`.
 *
 * NOTE on the count: `ASSESSMENT_DESIGN.md`'s summary line reads
 * "Total: 73 words", but both its flat word list *and* this mapping table
 * actually enumerate **74** unique words (the two sets are identical — no
 * word appears in one but not the other). The document's real content is the
 * source of truth, so all 74 are transcribed faithfully here rather than
 * silently dropping one; if a true 73 is intended, the extra word should be
 * resolved in the design doc first. `Zealous` maps to three tribes and is
 * handled like any other shared word (0.5 to each), per the table footnote.
 */
export const wordMappings: WordMapping[] = [
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

/** The flat, unlabeled adjective list shown to participants (in source order). */
export const words: string[] = wordMappings.map((m) => m.word);

/** Error thrown by {@link validateWords} when the mapping references a bad slug. */
export class WordMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WordMappingValidationError";
  }
}

/**
 * Assert that every tribe slug referenced by the mapping resolves against the
 * `tribes` source of truth, so the word data can never silently drift away
 * from the canonical tribe list. Throws naming every offending `word → slug`
 * pair. Call this in a test (and anywhere the data is loaded) to fail loudly.
 */
export function validateWords(mappings: WordMapping[] = wordMappings): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const problems: string[] = [];

  for (const { word, tribes: slugs } of mappings) {
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        problems.push(`"${word}" → "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new WordMappingValidationError(
      `Word mapping references unknown tribe slug(s): ${problems.join(", ")}. ` +
        `Valid slugs are: ${[...validSlugs].join(", ")}.`,
    );
  }
}
