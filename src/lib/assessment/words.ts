import { tribes } from "../tribes";

/**
 * Selection constraints for the assessment (ADR-0001 / PRD).
 * A Subject (or Observer) must select between MIN_WORDS and MAX_WORDS words;
 * submission is gated to this range so self and observer scores are comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * A single adjective from the flat word list and the tribe(s) it maps to,
 * referenced by tribe `slug`. A word mapped to more than one tribe is a
 * "shared" word: it contributes 0.5 to each mapped tribe (ASSESSMENT_DESIGN.md).
 */
export interface WordMapping {
  word: string;
  tribeSlugs: string[];
}

/**
 * The flat word list and its word→tribe(slug) mapping, transcribed verbatim
 * from the "Tribe Mapping" table in ASSESSMENT_DESIGN.md (the content source of
 * truth). Order matches the table; the UI shuffles per session.
 *
 * NOTE ON COUNT: ASSESSMENT_DESIGN.md's summary line reads "Total: 73 words",
 * but both its flat list and its mapping table actually enumerate 74 distinct
 * words (the "73" is an off-by-one in the doc's summary). We transcribe the real
 * 74 rows faithfully rather than arbitrarily drop one.
 */
export const wordMappings: WordMapping[] = [
  { word: "Aggressive", tribeSlugs: ["benjamin"] },
  { word: "Alert", tribeSlugs: ["dan"] },
  { word: "Analytical", tribeSlugs: ["issachar"] },
  { word: "Authoritative", tribeSlugs: ["judah"] },
  { word: "Battle-tested", tribeSlugs: ["gad"] },
  { word: "Bold", tribeSlugs: ["judah", "reuben"] },
  { word: "Cautious", tribeSlugs: ["dan", "issachar"] },
  { word: "Comforting", tribeSlugs: ["asher"] },
  { word: "Consistent", tribeSlugs: ["joseph"] },
  { word: "Convicted", tribeSlugs: ["simeon"] },
  { word: "Courageous", tribeSlugs: ["judah"] },
  { word: "Creative", tribeSlugs: ["naphtali"] },
  { word: "Cunning", tribeSlugs: ["benjamin", "dan"] },
  { word: "Decisive", tribeSlugs: ["simeon", "benjamin"] },
  { word: "Dedicated", tribeSlugs: ["levi"] },
  { word: "Deliberate", tribeSlugs: ["dan"] },
  { word: "Devoted", tribeSlugs: ["levi"] },
  { word: "Discerning", tribeSlugs: ["issachar", "dan"] },
  { word: "Driven", tribeSlugs: ["benjamin", "reuben"] },
  { word: "Enduring", tribeSlugs: ["gad", "joseph"] },
  { word: "Energetic", tribeSlugs: ["reuben"] },
  { word: "Enriching", tribeSlugs: ["asher"] },
  { word: "Enterprising", tribeSlugs: ["zebulun"] },
  { word: "Exacting", tribeSlugs: ["levi"] },
  { word: "Expansive", tribeSlugs: ["zebulun"] },
  { word: "Expressive", tribeSlugs: ["naphtali"] },
  { word: "Faithful", tribeSlugs: ["joseph"] },
  { word: "Fervent", tribeSlugs: ["simeon", "judah"] },
  { word: "Fierce", tribeSlugs: ["benjamin"] },
  { word: "Free-spirited", tribeSlugs: ["naphtali"] },
  { word: "Generous", tribeSlugs: ["zebulun", "asher"] },
  { word: "Graceful", tribeSlugs: ["naphtali"] },
  { word: "Gritty", tribeSlugs: ["gad"] },
  { word: "Guarding", tribeSlugs: ["levi", "benjamin"] },
  { word: "Healing", tribeSlugs: ["naphtali"] },
  { word: "Honorable", tribeSlugs: ["judah"] },
  { word: "Hospitable", tribeSlugs: ["asher"] },
  { word: "Impulsive", tribeSlugs: ["reuben"] },
  { word: "Insightful", tribeSlugs: ["issachar"] },
  { word: "Inspiring", tribeSlugs: ["naphtali"] },
  { word: "Intense", tribeSlugs: ["benjamin", "reuben"] },
  { word: "Just", tribeSlugs: ["simeon"] },
  { word: "Learned", tribeSlugs: ["issachar"] },
  { word: "Loyal", tribeSlugs: ["joseph", "benjamin"] },
  { word: "Measured", tribeSlugs: ["issachar"] },
  { word: "Nurturing", tribeSlugs: ["asher"] },
  { word: "Observant", tribeSlugs: ["dan", "issachar"] },
  { word: "Organized", tribeSlugs: ["joseph"] },
  { word: "Passionate", tribeSlugs: ["reuben", "simeon"] },
  { word: "Patient", tribeSlugs: ["issachar"] },
  { word: "Peaceful", tribeSlugs: ["asher"] },
  { word: "Perceptive", tribeSlugs: ["issachar", "dan"] },
  { word: "Precise", tribeSlugs: ["levi"] },
  { word: "Prosperous", tribeSlugs: ["zebulun"] },
  { word: "Protective", tribeSlugs: ["benjamin", "judah"] },
  { word: "Reliable", tribeSlugs: ["joseph"] },
  { word: "Resilient", tribeSlugs: ["joseph", "gad"] },
  { word: "Resourceful", tribeSlugs: ["zebulun"] },
  { word: "Reverent", tribeSlugs: ["levi"] },
  { word: "Righteous", tribeSlugs: ["simeon"] },
  { word: "Sacrificial", tribeSlugs: ["judah"] },
  { word: "Skeptical", tribeSlugs: ["dan"] },
  { word: "Steady", tribeSlugs: ["joseph", "gad"] },
  { word: "Strategic", tribeSlugs: ["issachar", "dan"] },
  { word: "Strong", tribeSlugs: ["reuben", "judah"] },
  { word: "Supportive", tribeSlugs: ["joseph", "asher"] },
  { word: "Territorial", tribeSlugs: ["benjamin", "gad"] },
  { word: "Tough", tribeSlugs: ["gad"] },
  { word: "Uncompromising", tribeSlugs: ["simeon"] },
  { word: "Vigilant", tribeSlugs: ["dan"] },
  { word: "Watchful", tribeSlugs: ["dan"] },
  { word: "Welcoming", tribeSlugs: ["asher"] },
  { word: "Wise", tribeSlugs: ["issachar"] },
  { word: "Zealous", tribeSlugs: ["judah", "benjamin", "simeon"] },
];

/** The flat list of words shown to participants (UI shuffles per session). */
export const words: string[] = wordMappings.map((m) => m.word);

/**
 * Asserts that every tribe slug referenced in the word mappings resolves
 * against the `tribes` source of truth, so the data can never silently drift.
 * Fails loudly (throws) listing every offending word→slug pair.
 *
 * Accepts the mappings as an argument (defaulting to the real list) so the
 * invariant can be exercised against deliberately-bad data in tests.
 */
export function validateWordMappings(mappings: WordMapping[] = wordMappings): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const offenders: string[] = [];
  for (const mapping of mappings) {
    for (const slug of mapping.tribeSlugs) {
      if (!validSlugs.has(slug)) {
        offenders.push(`${mapping.word} → ${slug}`);
      }
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `Word mapping references unknown tribe slug(s): ${offenders.join(", ")}`,
    );
  }
}
