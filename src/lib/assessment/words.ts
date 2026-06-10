import { tribes } from "../tribes";

/**
 * The flat, unlabeled adjective list participants choose from, plus each word's
 * mapping to one or more tribes (referenced by tribe `slug`).
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`,
 * transcribed faithfully. A word mapped to a single tribe scores a full point
 * to that tribe; a word mapped to more than one tribe is a *shared* word and
 * scores 0.5 to each of its tribes (see `score`).
 *
 * Note on the count: the document's prose header says "Total: 73 words", but
 * both the flat list and the mapping table it is distilled from actually
 * enumerate 74 distinct words (the header is an off-by-one miscount in the
 * source). All 74 mappings are transcribed here rather than silently dropping
 * one, so the data matches the authoritative mapping table exactly.
 */
export interface AssessmentWord {
  /** The adjective shown to the participant. */
  word: string;
  /** Tribe slugs this word maps to (1 = full point, >1 = shared at 0.5 each). */
  tribes: string[];
}

/** Soft selection range: submission is gated to between these (inclusive). */
export const MIN_SELECTION = 8;
export const MAX_SELECTION = 15;

export const assessmentWords: AssessmentWord[] = [
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
 * Returns the set of tribe slugs referenced by `entries` that do not exist in
 * the `tribes` source of truth. Pure and testable against arbitrary input so
 * both the happy path (real data) and the failure path can be exercised.
 */
export function invalidSlugsIn(entries: AssessmentWord[]): string[] {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const bad = new Set<string>();
  for (const entry of entries) {
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) bad.add(slug);
    }
  }
  return [...bad];
}

/**
 * Fails loudly if the word data references any tribe slug that does not exist
 * in `tribes`, so the mapping can never silently drift from the source of
 * truth. Intended to be called in a test (and safe to call at startup).
 */
export function assertValidWordData(): void {
  const bad = invalidSlugsIn(assessmentWords);
  if (bad.length > 0) {
    throw new Error(
      `Assessment word data references unknown tribe slugs: ${bad.join(", ")}`,
    );
  }
}
