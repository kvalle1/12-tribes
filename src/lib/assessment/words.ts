import { tribes } from "@/lib/tribes";

/**
 * The flat adjective list and its word→tribe(slug) mapping, transcribed
 * faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Participants only ever see {@link wordList} (the bare adjectives, shuffled
 * per session in the UI layer). The tribe mapping is the backend scoring
 * source and is never surfaced to participants.
 *
 * A word mapped to a single tribe contributes its full weight (1) to that
 * tribe; a word mapped to more than one tribe is a *shared* word and
 * contributes {@link SHARED_WEIGHT} (0.5) to each mapped tribe.
 */
export interface WordMapping {
  readonly word: string;
  /** One or more tribe slugs from `tribes.ts`. */
  readonly tribes: readonly string[];
}

/** Soft selection range: a submission must pick within [MIN_WORDS, MAX_WORDS]. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/** Per-tribe weight contributed by a word shared across multiple tribes. */
export const SHARED_WEIGHT = 0.5;

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

/** The bare adjectives participants see (no tribe labels). */
export const wordList: readonly string[] = words.map((w) => w.word);

/**
 * Assert that the word mapping data is internally consistent: every word maps
 * to at least one tribe, and every referenced slug resolves against the
 * `tribes` source of truth. Fails loudly so the data can never silently drift.
 *
 * Takes its inputs as arguments (defaulting to the real data) so the failure
 * path is unit-testable without mutating the shipped mapping.
 */
export function validateWordMappings(
  mappings: readonly WordMapping[] = words,
  validSlugs: ReadonlySet<string> = new Set(tribes.map((t) => t.slug)),
): void {
  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (seen.has(mapping.word)) {
      throw new Error(`Duplicate word in mapping: "${mapping.word}"`);
    }
    seen.add(mapping.word);

    if (mapping.tribes.length === 0) {
      throw new Error(`Word "${mapping.word}" maps to no tribes`);
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
