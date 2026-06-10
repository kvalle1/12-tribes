import { tribes } from "@/lib/tribes";

/**
 * Word data for the Tribe Index assessment.
 *
 * The flat adjective list a participant sees, and the (hidden) mapping of each
 * word to the tribe(s) it expresses. Transcribed faithfully from the "Tribe
 * Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Scoring weight per (word, tribe): a word mapped to a single tribe contributes
 * 1.0 to that tribe; a *shared* word (mapped to more than one tribe) contributes
 * 0.5 to each — the doc's asterisk convention ("shared word, scores 0.5 to each
 * mapped tribe"). Most shared words map to two tribes; "Zealous" maps to three,
 * and the 0.5-per-mapping rule applies uniformly.
 */
export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (1 or more). */
  tribes: string[];
}

/** Minimum number of words a participant may select. */
export const MIN_SELECTION = 8;
/** Maximum number of words a participant may select. */
export const MAX_SELECTION = 15;

/** Whether a selection count falls within the allowed range. */
export function isSelectionInRange(count: number): boolean {
  return count >= MIN_SELECTION && count <= MAX_SELECTION;
}

/**
 * The word → tribe(slug) mapping, transcribed from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`. Order matches the table; presentation order is
 * shuffled per session elsewhere, not here.
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

/** The flat list of adjectives shown to participants (mapping order). */
export const words: string[] = wordMappings.map((m) => m.word);

/**
 * The scoring weight a single mapping contributes: 1.0 for a word that belongs
 * to exactly one tribe, 0.5 for a shared word (regardless of how many tribes it
 * is shared across).
 */
export function mappingWeight(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Assert every tribe slug referenced by `mappings` exists in the given set of
 * valid slugs (defaulting to the `tribes` source of truth), and that there are
 * no duplicate words. Throws loudly with the offending values so the data can
 * never silently drift from `tribes.ts`.
 */
export function validateWordMappings(
  mappings: WordMapping[] = wordMappings,
  validSlugs: ReadonlySet<string> = new Set(tribes.map((t) => t.slug)),
): void {
  const badSlugs = new Set<string>();
  for (const mapping of mappings) {
    if (mapping.tribes.length === 0) {
      throw new Error(`Word "${mapping.word}" maps to no tribe`);
    }
    for (const slug of mapping.tribes) {
      if (!validSlugs.has(slug)) {
        badSlugs.add(slug);
      }
    }
  }
  if (badSlugs.size > 0) {
    throw new Error(
      `Word mappings reference unknown tribe slug(s): ${[...badSlugs]
        .sort()
        .join(", ")}`,
    );
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { word } of mappings) {
    if (seen.has(word)) duplicates.add(word);
    seen.add(word);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate word(s) in mapping: ${[...duplicates].sort().join(", ")}`,
    );
  }
}
