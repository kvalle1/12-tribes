import { getTribeBySlug } from "@/lib/tribes";

/**
 * The flat adjective list and its word→tribe(s) mapping, transcribed from the
 * "Tribe Mapping" table in ASSESSMENT_DESIGN.md — the source of truth for
 * scoring. Tribes are referenced by `slug` so the data can be validated against
 * the `tribes` source of truth and can never silently drift.
 *
 * Note on count: ASSESSMENT_DESIGN.md's prose header reads "Total: 73 words",
 * but both the flat list and the mapping table it enumerates actually contain
 * 74 entries (the "73" is a typo in the doc). The "Word Coverage by Tribe"
 * summary table in that doc also has hand-counting errors, so coverage is
 * derived from this mapping rather than transcribed from that summary.
 *
 * A word mapped to more than one tribe is a "shared" word: it contributes a
 * fractional weight to each of its tribes (see `score`). The lone three-tribe
 * word ("Zealous") is treated the same as any shared word.
 */
export interface WordMapping {
  /** The adjective exactly as presented to participants. */
  word: string;
  /** The tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/** Minimum number of words a valid selection must contain. */
export const MIN_WORDS = 8;
/** Maximum number of words a valid selection may contain. */
export const MAX_WORDS = 15;

/** Whether a selection of `count` words is within the submittable range. */
export function isSelectionInRange(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}

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

/** The flat list of adjectives presented to participants, in canonical order. */
export const words: string[] = wordMappings.map((m) => m.word);

/**
 * Asserts the integrity of the word data, failing loudly (throwing) when:
 *  - any mapped tribe slug does not resolve against the `tribes` source of truth,
 *  - a word is mapped to zero tribes, or
 *  - a word appears more than once.
 *
 * Accepts an explicit `mappings` argument so the invariant can be exercised
 * against deliberately-bad data in tests; defaults to the real `wordMappings`.
 */
export function validateWordMappings(
  mappings: WordMapping[] = wordMappings,
): void {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const mapping of mappings) {
    if (seen.has(mapping.word)) {
      problems.push(`Duplicate word: "${mapping.word}"`);
    }
    seen.add(mapping.word);

    if (mapping.tribes.length === 0) {
      problems.push(`Word "${mapping.word}" maps to no tribe`);
    }

    for (const slug of mapping.tribes) {
      if (!getTribeBySlug(slug)) {
        problems.push(`Word "${mapping.word}" maps to unknown tribe "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid word mappings:\n${problems.join("\n")}`);
  }
}
