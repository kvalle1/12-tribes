import { tribes } from "../tribes";

/**
 * Word data for the Tribe Index assessment.
 *
 * Transcribed faithfully from the **Tribe Mapping** table in
 * `ASSESSMENT_DESIGN.md` — the backend scoring source of truth. Each entry maps
 * a word to the tribe slug(s) it counts toward. A word mapped to more than one
 * tribe is a *shared* word and contributes a reduced weight to each (see
 * {@link wordWeight}).
 *
 * Note on the count: `ASSESSMENT_DESIGN.md` heads the list "Total: 73 words",
 * but both the flat list and the mapping table actually enumerate **74** rows
 * (the header is an off-by-one tally; the mapping table is authoritative). We
 * transcribe all 74 mappings here.
 */

/** A word and the tribe slug(s) it scores toward. */
export interface WordMapping {
  word: string;
  /** Tribe slugs (must resolve against `tribes`); validated by {@link validateWordMappings}. */
  tribes: string[];
}

/** Soft selection range enforced by the assessment UI (constants live with the data). */
export const MIN_WORDS = 8;
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
 * Per-tribe weight a word contributes. A word mapped to a single tribe scores a
 * full point; a *shared* word (two or more tribes) scores 0.5 to **each** mapped
 * tribe, per the mapping table's footnote.
 */
export function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length <= 1 ? 1 : 0.5;
}

/**
 * Assert every referenced tribe slug exists in the `tribes` source of truth, so
 * the word data can never silently drift from the tribe model. Throws loudly,
 * listing the offending `word → slug` pairs, when any slug is unknown.
 *
 * Accepts the mappings to check (defaults to {@link words}) so the invariant can
 * be exercised against fixtures in tests.
 */
export function validateWordMappings(mappings: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const bad: string[] = [];
  for (const mapping of mappings) {
    for (const slug of mapping.tribes) {
      if (!validSlugs.has(slug)) {
        bad.push(`${mapping.word} → ${slug}`);
      }
    }
  }
  if (bad.length > 0) {
    throw new Error(
      `Invalid tribe slug(s) in word mapping: ${bad.join(", ")}`,
    );
  }
}
