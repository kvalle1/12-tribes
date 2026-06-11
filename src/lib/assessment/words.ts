import { tribes } from "../tribes";

/**
 * The assessment word data — the single source of truth for the flat,
 * unlabeled adjective list a Subject (or Observer) chooses from, and the
 * mapping of each word to the tribe(s) it signals.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`. A word maps to one tribe (exclusive) or to two or
 * three tribes (shared). Shared words are scored at a reduced weight — see
 * `score.ts` — so they never count as a full signal for any single tribe.
 *
 * Tribes are referenced by `slug`, matching `tribes.ts`. `validateWordMappings`
 * asserts every referenced slug resolves, so the data can never silently drift
 * from the `tribes` source of truth.
 */
export interface WordMapping {
  /** The adjective exactly as presented to participants. */
  word: string;
  /** Tribe slug(s) this word signals. One slug = exclusive; more = shared. */
  tribes: string[];
}

/** Minimum number of words a participant must select to submit. */
export const MIN_WORDS = 8;
/** Maximum number of words a participant may select. */
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

/**
 * Assert that every tribe slug referenced by the word mappings resolves to a
 * real tribe in `tribes.ts`. Throws loudly (listing every offender) if any
 * mapping references an unknown slug, so authoring mistakes can't slip through.
 *
 * Defaults to validating the canonical `words` list; accepts a custom list so
 * the validation behavior itself can be tested.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const errors: string[] = [];

  for (const mapping of mappings) {
    if (mapping.tribes.length === 0) {
      errors.push(`Word "${mapping.word}" maps to no tribe`);
    }
    for (const slug of mapping.tribes) {
      if (!validSlugs.has(slug)) {
        errors.push(
          `Word "${mapping.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid word→tribe mappings:\n${errors.join("\n")}`);
  }
}
